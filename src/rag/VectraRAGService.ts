// src/rag/VectraRAGService.ts
import { readdir, readFile, mkdir, writeFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join, extname } from 'path';
import { LocalIndex } from 'vectra';
import { pipeline, type FeatureExtractionPipeline } from '@xenova/transformers';
import { logger } from '../utils/logger.js';
import type { RAGContext } from '../types/index.js';

// Get the directory of this file (src/rag/VectraRAGService.ts)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Root of the CLI repo (assume src/ is one level down)
const REPO_ROOT = join(__dirname, '../..');
const KB_PATH = join(REPO_ROOT, 'knowledge-base');
const INDEX_PATH = join(REPO_ROOT, '.vectra-index');
const EMB_MODEL = 'Xenova/all-MiniLM-L6-v2';

export class VectraRAGService {
  private index!: LocalIndex;
  private embed: FeatureExtractionPipeline | undefined;
  private initialized = false;

  async init() {
    if (this.initialized) return;

    logger.info('Initializing Vectra and embedding model...');

    // Initialize embedding model
    this.embed = await pipeline('feature-extraction', EMB_MODEL, { quantized: true });

    // Initialize or create Vectra index
    try {
      this.index = new LocalIndex(INDEX_PATH);
      if (!await this.index.isIndexCreated()) {
        await this.index.createIndex();
        logger.info('Created new Vectra index');
      } else {
        logger.info('Loaded existing Vectra index');
      }
    } catch (error) {
      logger.warn('Creating new Vectra index due to error:', error);
      this.index = new LocalIndex(INDEX_PATH);
      await this.index.createIndex();
    }

    this.initialized = true;
    logger.success('VectraRAGService initialized');
  }

  async ingestKnowledgeBase(): Promise<void> {
    await this.init();
    logger.info('🔄 Indexing knowledge-base...');

    const docs: { id: string; text: string; meta: Record<string, unknown> }[] = [];
    await this.walkDirectory(KB_PATH, async (file) => {
      if (!this.isSupportedFile(file)) return;

      try {
        const content = await readFile(file, 'utf8');
        const { clean, meta } = this.stripFrontMatter(content);
        const type = this.inferType(file);

        docs.push({
          id: file,
          text: clean,
          meta: { ...meta, file, type },
        });
      } catch (error) {
        logger.warn(`Failed to read file ${file}:`, error);
      }
    });

    if (docs.length === 0) {
      logger.warn('No documents found in knowledge-base. Creating sample files...');
      await this.createSampleKnowledgeBase();
      return this.ingestKnowledgeBase(); // Retry after creating samples
    }

    logger.info(`Processing ${docs.length} documents...`);

    // Clear existing items (for fresh indexing)
    await this.index.deleteIndex();
    await this.index.createIndex();

    // Add documents to index
    for (const doc of docs) {
      try {
        const embedding = await this.generateEmbedding(doc.text);
        await this.index.insertItem({
          vector: embedding,
          metadata: {
            id: doc.id,
            content: doc.text,
            type: typeof doc.meta.type === 'string' ? doc.meta.type : String(doc.meta.type),
            file: typeof doc.meta.file === 'string' ? doc.meta.file : String(doc.meta.file),
            ...doc.meta
          }
        });
      } catch (error) {
        logger.warn(`Failed to embed document ${doc.id}:`, error);
      }
    }

    logger.success(`✅ ${docs.length} documents indexed successfully`);
  }

  async query(text: string, topK = 15, minScore = 0.3): Promise<RAGContext[]> {
    await this.init();

    if (!text || text.trim().length < 3) {
      logger.warn('Query text is empty or too short.');
      return [];
    }

    try {
      const queryEmbedding = await this.generateEmbedding(text);
      const results = await this.index.queryItems(queryEmbedding, text, topK);

      if (!results || results.length === 0) {
        logger.warn('No results found in knowledge base for query:', text);
        return [];
      }

      let filtered = results.filter(result => result.score >= minScore);
      if (filtered.length === 0) {
        logger.info(`No results above minScore=${minScore}. Lowering threshold to 0.1 and retrying filter.`);
        filtered = results.filter(result => result.score >= 0.1);
      }
      if (filtered.length === 0) {
        logger.info('Still no results above 0.1. Returning topK results regardless of score.');
        filtered = results;
      }

      logger.info(`Returning ${filtered.length} results for query: ${text}`);
      return filtered
        .map(result => ({
          id: result.item.metadata.id as string,
          content: result.item.metadata.content as string,
          type: (result.item.metadata.type as string) || 'unknown',
          score: result.score,
          metadata: result.item.metadata as Record<string, unknown>,
        }))
        .sort((a, b) => b.score - a.score);
    } catch (error) {
      logger.error('Query failed:', error);
      return [];
    }
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    if (!this.embed) throw new Error('Embedding model not initialized');
    const result = await this.embed(text);
    if (Array.isArray(result)) {
      if (Array.isArray(result[0])) return result[0];
      return result as number[];
    } else if (result && typeof result.data === 'object' && Array.isArray(result.data)) {
      return result.data;
    } else if (result && Array.isArray(result.data?.[0])) {
      return result.data[0];
    } else if (result && typeof result === 'object') {
      // Fallback: try to find a numeric array in the object
      const arr = Object.values(result).find(v => Array.isArray(v) && typeof v[0] === 'number');
      if (arr) return arr as number[];
    }
    throw new Error('Unexpected embedding result format: ' + JSON.stringify(result));
  }

  private async walkDirectory(dir: string, fn: (file: string) => Promise<void>) {
    try {
      const entries = await readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
          await this.walkDirectory(fullPath, fn);
        } else {
          await fn(fullPath);
        }
      }
    } catch (error) {
      logger.warn(`Could not read directory ${dir}:`, error);
    }
  }

  private isSupportedFile(file: string): boolean {
    const supportedExts = ['.md', '.txt', '.ts', '.js', '.json', '.yml', '.yaml'];
    return supportedExts.includes(extname(file).toLowerCase());
  }

  private inferType(filePath: string): 'selector' | 'workflow' | 'pattern' | 'fixture' {
    if (filePath.includes('/selectors/')) return 'selector';
    if (filePath.includes('/workflows/')) return 'workflow';
    if (filePath.includes('/patterns/')) return 'pattern';
    return 'fixture';
  }

  private stripFrontMatter(src: string): { clean: string; meta: Record<string, unknown> } {
    if (src.startsWith('---')) {
      const parts = src.split(/---\s*\n/);
      if (parts.length >= 3) {
        const frontMatter = parts[1];
        const content = parts.slice(2).join('---\n');
        const meta: Record<string, unknown> = {};

        frontMatter.split(/\n/).forEach((line) => {
          const match = line.match(/^(\w+):\s*(.*)$/);
          if (match) {
            meta[match[1]] = match[2];
          }
        });

        return { clean: content.trim(), meta };
      }
    }
    return { clean: src.trim(), meta: {} };
  }

  private async createSampleKnowledgeBase(): Promise<void> {
    // Create sample selector file
    await mkdir('knowledge-base/selectors', { recursive: true });
    await writeFile('knowledge-base/selectors/login.md', `---
type: selector
category: authentication
---

# Login Selectors

## Username Input
\`\`\`
page.getByLabel('Username')
page.getByTestId('username-input')
page.locator('input[name="username"]')
\`\`\`

## Password Input
\`\`\`
page.getByLabel('Password')
page.getByTestId('password-input')
page.locator('input[name="password"]')
\`\`\`

## Login Button
\`\`\`
page.getByRole('button', { name: /sign in|login/i })
page.getByTestId('login-button')
\`\`\`
`);

    // Create sample workflow file
    await mkdir('knowledge-base/workflows', { recursive: true });
    await writeFile('knowledge-base/workflows/authentication.md', `---
type: workflow
category: authentication
---

# Authentication Workflow

## Standard Login Flow
1. Navigate to login page
2. Fill username field
3. Fill password field
4. Click login button
5. Wait for dashboard to load

## Code Example
\`\`\`typescript
await page.goto(process.env.BASE_URL + '/login');
await page.getByLabel('Username').fill('imail-test+DemoProdDirector@vcreativeinc.com');
await page.getByLabel('Password').fill('TeamVC#Rocks2025');
await page.getByRole('button', { name: /sign in/i }).click();
await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();
\`\`\`
`);

    // Create sample patterns file
    await mkdir('knowledge-base/patterns', { recursive: true });
    await writeFile('knowledge-base/patterns/common-patterns.md', `---
type: pattern
category: best-practices
---

# Common Playwright Patterns

## Waiting for Elements
\`\`\`typescript
// Good - use expect with timeout
await expect(page.locator('.loading')).toBeVisible();
await expect(page.locator('.loading')).toBeHidden();

// Better - wait for specific state
await page.waitForLoadState('networkidle');
\`\`\`

## Form Interactions
\`\`\`typescript
// Fill form fields
await page.getByLabel('Email').fill('user@example.com');
await page.getByLabel('Password').fill('password123');

// Submit form
await page.getByRole('button', { name: /submit|save/i }).click();
\`\`\`

## Navigation
\`\`\`typescript
// Navigate and wait
await page.goto('/dashboard');
await page.waitForLoadState('networkidle');
await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();
\`\`\`
`);

    logger.info('Created sample knowledge base files');
  }
}
