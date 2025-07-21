// src/core/TestGenerator.ts
import { writeFile, mkdir } from 'fs/promises';
import { dirname, basename, extname } from 'path';
import { VectraRAGService } from '../rag/VectraRAGService.js';
import { OpenAIService } from '../ai/OpenAIService.js';
import { PlaywrightCodeGenerator } from '../playwright/PlaywrightCodeGenerator.js';
import { CodeFormatter } from '../utils/CodeFormatter.js';
import type { TestConfig, GeneratedTest, RAGContext } from '../types/index.js';
import { logger } from '../utils/logger.js';

export class TestGenerator {
  private ragService: VectraRAGService;
  private openaiService: OpenAIService;
  private codeGenerator: PlaywrightCodeGenerator;
  private formatter: CodeFormatter;

  constructor() {
    this.ragService = new VectraRAGService();
    this.openaiService = new OpenAIService();
    this.codeGenerator = new PlaywrightCodeGenerator();
    this.formatter = new CodeFormatter();
  }

  async generate(config: TestConfig): Promise<GeneratedTest & { content: string }> {
    logger.info(`Generating test for ticket: ${config.ticket.key}`);

    const ragContexts = await this.retrieveContext(config);
    logger.info(`Retrieved ${ragContexts.length} relevant contexts`);

    // Force-include best-practices context for login/error tests
    const isLoginTest = /login|authentication|credentials|error message|invalid/i.test(
      config.ticket.summary + config.ticket.description + (config.ticket.acceptanceCriteria || []).join(' ')
    );
    const hasBestPractices = ragContexts.some(ctx => ctx.content.includes('getByRole') && ctx.content.includes('test.step'));
    if (isLoginTest && !hasBestPractices) {
      const fs = await import('fs/promises');
      const bestPractices = await fs.readFile('knowledge-base/patterns/playwright-best-practices.md', 'utf8');
      ragContexts.push({
        id: 'best-practices',
        content: bestPractices,
        type: 'pattern',
        score: 1.0,
      });
      logger.info('Appended best-practices context for login/error test');
    }

    const generatedCode = await this.generateTestCode(config, ragContexts);
    const formattedCode = await this.formatter.format(generatedCode);
    const confidence = this.calculateConfidence(ragContexts, generatedCode);

    let finalPath = config.outputPath;
    if (!config.dryRun) {
      finalPath = await this.writeTestFile(config.outputPath, formattedCode, !!config.overwrite);
    }

    const result: GeneratedTest & { content: string } = {
      filePath: finalPath,
      testName: this.extractTestName(config.ticket.summary),
      ticket: config.ticket,
      environment: config.environment,
      generatedAt: new Date().toISOString(),
      ragContexts,
      confidence,
      content: formattedCode
    };

    logger.info(`Test generation completed with ${Math.round(confidence * 100)}% confidence`);
    return result;
  }

  private async retrieveContext(config: TestConfig): Promise<RAGContext[]> {
    const query = [
      config.ticket.summary,
      config.ticket.description,
      ...(config.ticket.acceptanceCriteria || [])
    ].join(' ');

    return await this.ragService.query(query);
  }

  private async generateTestCode(config: TestConfig, contexts: RAGContext[]): Promise<string> {
    const prompt = this.buildPrompt(config, contexts);
    const response = await this.openaiService.generateCode(prompt);

    return this.codeGenerator.enhanceGeneratedCode(response, config);
  }

  private buildPrompt(config: TestConfig, contexts: RAGContext[]): string {
    const systemPrompt = `You are an expert Playwright test generator. Generate robust, non-flaky E2E tests based on Jira tickets and provided context.

CRITICAL REQUIREMENTS:
1. Use ONLY selectors and patterns from the provided context - never hallucinate selectors
2. Implement proper waiting strategies with expect() assertions
3. Use page object pattern when specified
4. Include proper error handling and retry logic
5. Generate TypeScript code with proper imports
6. Use environment variables for URLs and credentials
7. Follow Playwright best practices for stability

SELECTOR PRIORITY (use in this order):
1. data-testid attributes
2. role-based locators (getByRole)
3. label-based locators (getByLabel)
4. text-based locators (getByText) - only for unique text
5. CSS selectors - only as last resort

WAITING STRATEGY:
- Use expect(locator).toBeVisible() instead of waitForSelector
- Use expect(locator).toHaveText() for text verification
- Use page.waitForLoadState('networkidle') after navigation
- Implement auto-retry with proper timeouts`;

    const contextSection = contexts.length > 0 
      ? `\n\nAVAILABLE CONTEXT:\n${contexts.map(ctx => 
          `[${ctx.type.toUpperCase()}] (score: ${ctx.score.toFixed(2)})\n${ctx.content}`
        ).join('\n\n---\n\n')}`
      : '';

    const ticketSection = `\n\nJIRA TICKET:
Key: ${config.ticket.key}
Summary: ${config.ticket.summary}
Description: ${config.ticket.description}
${config.ticket.acceptanceCriteria ? `Acceptance Criteria:\n${config.ticket.acceptanceCriteria.map((c: string) => `- ${c}`).join('\n')}` : ''}`;

    const configSection = `\n\nCONFIGURATION:
Environment: ${config.environment}
Page Objects: ${config.pageObjectPattern ? 'enabled' : 'disabled'}
Base URL: Use the selected environment's base URL directly (e.g., "${getBaseUrl(config.environment)}") instead of process.env.TEST_BASE_URL`;

    const instructionSection = `\n\nINSTRUCTIONS:
Generate a complete Playwright test that:
1. Follows the ticket requirements exactly
2. Uses only the selectors/patterns from the provided context
3. Implements proper page object pattern (if enabled)
4. Includes comprehensive assertions for each step
5. Handles authentication using environment variables
6. Is resilient to timing issues and UI changes
7. Use the test.step structure for each logical step in the test
8. For login flows, always use getByRole for email, password, and login fields/buttons as shown in the best practices context
9. For invalid login, verify error message and do not redirect
10. Take a screenshot on failure using test.afterEach as shown in best practices context
\n\nReturn ONLY the TypeScript test code, no explanations.`;

    function getBaseUrl(env: string): string {
      switch (env) {
        case 'prod': return 'http://localhost:4200';
        case 'test': return 'https://two-test.vcreative.net';
        case 'qa': return 'https://qa.vcreative.net';
        case 'staging': return 'https://smoketest.vcreative.net';
        default: return '';
      }
    }

    return systemPrompt + contextSection + ticketSection + configSection + instructionSection;
  }

  private calculateConfidence(contexts: RAGContext[], generatedCode: string): number {
    let confidence = 0.5;

    const avgContextScore = contexts.reduce((sum, ctx) => sum + ctx.score, 0) / contexts.length;
    confidence += avgContextScore * 0.3;

    const workflowContexts = contexts.filter(ctx => ctx.type === 'workflow').length;
    const selectorContexts = contexts.filter(ctx => ctx.type === 'selector').length;

    if (workflowContexts > 0) confidence += 0.1;
    if (selectorContexts >= 5) confidence += 0.1;

    if (generatedCode.includes('text=')) confidence -= 0.1;
    if (generatedCode.includes('waitForTimeout')) confidence -= 0.15;
    if (!generatedCode.includes('expect(')) confidence -= 0.2;

    if (generatedCode.includes('getByTestId')) confidence += 0.1;
    if (generatedCode.includes('getByRole')) confidence += 0.05;
    if (generatedCode.includes('toBeVisible')) confidence += 0.05;
    if (generatedCode.includes('process.env')) confidence += 0.05;

    return Math.max(0, Math.min(1, confidence));
  }

  private extractTestName(summary: string): string {
    return summary
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .slice(0, 6)
      .join(' ');
  }

  private async writeTestFile(outputPath: string, content: string, overwrite: boolean): Promise<string> {
    await mkdir(dirname(outputPath), { recursive: true });

    let finalPath = outputPath;
    if (!overwrite) {
      finalPath = await this.getUniqueFilePath(outputPath);
    }

    await writeFile(finalPath, content, 'utf-8');
    logger.info(`Test written to: ${finalPath}`);

    return finalPath;
  }

  private async getUniqueFilePath(originalPath: string): Promise<string> {
    const { access } = await import('fs/promises');
    const dir = dirname(originalPath);
    const name = basename(originalPath, extname(originalPath));
    const ext = extname(originalPath);

    let counter = 1;
    let testPath = originalPath;

    while (true) {
      try {
        await access(testPath);
        testPath = `${dir}/${name}-${counter}${ext}`;
        counter++;
      } catch {
        break;
      }
    }

    return testPath;
  }
}

export function getBaseUrl(env: string): string {
  switch (env) {
    case 'prod': return 'http://localhost:4200';
    case 'test': return 'https://two-test.vcreative.net';
    case 'qa': return 'https://qa.vcreative.net';
    case 'staging': return 'https://smoketest.vcreative.net';
    default: return '';
  }
}

// Make getBaseUrl available for CLI
export const TestGeneratorUtils = { getBaseUrl };
