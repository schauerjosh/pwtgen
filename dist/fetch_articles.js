"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const axios_1 = __importDefault(require("axios"));
// TODO: Fill in with the 32 vProMedia knowledge base article URLs and titles
const articles = [
// Example:
// { title: 'How to Login', url: 'https://kb.vcreative.net/article/how-to-login' },
];
const outPath = path_1.default.join(__dirname, '../knowledgebase/articles.json');
async function fetchAllArticles() {
    const results = [];
    for (const article of articles) {
        try {
            const response = await axios_1.default.get(article.url);
            // Extract main content (customize selector as needed)
            const content = response.data;
            results.push({ ...article, content });
            console.log(`Fetched: ${article.title}`);
        }
        catch (err) {
            console.error(`Failed to fetch: ${article.title} (${article.url})`);
            results.push({ ...article, content: '' });
        }
    }
    fs_1.default.writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf8');
    console.log(`\nArticles saved to ${outPath}`);
}
fetchAllArticles();
