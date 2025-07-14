"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const openai_1 = require("openai");
const config_1 = require("./config");
const articlesPath = path_1.default.join(__dirname, '../knowledgebase/articles.json');
const outPath = path_1.default.join(__dirname, '../knowledgebase/article_embeddings.json');
const articles = JSON.parse(fs_1.default.readFileSync(articlesPath, 'utf8'));
const openai = new openai_1.OpenAI({ apiKey: config_1.config.openaiApiKey });
// Synonyms for business actions
const synonyms = {
    order: ['spot', 'qo', 'quick order', 'purchase order'],
    approve: ['confirm', 'accept', 'validate'],
    email: ['notification', 'message', 'mail'],
    assign: ['allocate', 'set', 'designate'],
    login: ['sign in', 'authenticate'],
    // Add more as needed
};
function extractTags(text) {
    const tags = [];
    const patterns = [
        /selector:\s*([^\s]+)/gi,
        /workflow/gi,
        /playwright/gi,
        /order/gi,
        /spot/gi,
        /approval/gi,
        /dubbed/gi,
        /checkbox/gi,
        /hover/gi,
        /POC/gi,
        /test/gi,
        /automation/gi,
        /business action/gi,
    ];
    for (const pattern of patterns) {
        const matches = text.match(pattern);
        if (matches)
            tags.push(...matches.map(m => m.toLowerCase()));
    }
    // Add synonyms
    Object.keys(synonyms).forEach(key => {
        if (text.toLowerCase().includes(key)) {
            tags.push(...synonyms[key]);
        }
    });
    return Array.from(new Set(tags));
}
function normalizeContent(text) {
    return text
        .replace(/\s+/g, ' ')
        .replace(/[\r\n]+/g, ' ')
        .replace(/(test code:|example:)/gi, '')
        .trim();
}
async function embedAll() {
    const embeddings = [];
    for (const article of articles) {
        const tags = extractTags(article.content);
        const text = normalizeContent(`${article.title}\n${article.content}\n${tags.join(' ')}`);
        const response = await openai.embeddings.create({
            model: 'text-embedding-ada-002',
            input: text,
        });
        embeddings.push({
            title: article.title,
            url: article.url,
            tags,
            embedding: response.data[0].embedding,
        });
        console.log(`Embedded: ${article.title} [tags: ${tags.join(', ')}]`);
    }
    fs_1.default.writeFileSync(outPath, JSON.stringify(embeddings, null, 2), 'utf8');
    console.log(`\nEmbeddings saved to ${outPath}`);
}
embedAll();
