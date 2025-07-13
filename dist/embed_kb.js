"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const openai_1 = require("openai");
const config_1 = require("./config");
const kbPath = path_1.default.join(__dirname, '../knowledgebase/actions.json');
const outPath = path_1.default.join(__dirname, '../knowledgebase/embeddings.json');
const actions = JSON.parse(fs_1.default.readFileSync(kbPath, 'utf8'));
const openai = new openai_1.OpenAI({ apiKey: config_1.config.openaiApiKey });
async function embedAll() {
    const embeddings = [];
    for (const action of actions) {
        const text = `${action.action}\n${(action.steps || []).join('\n')}`;
        const response = await openai.embeddings.create({
            model: 'text-embedding-ada-002',
            input: text,
        });
        embeddings.push({
            action: action.action,
            steps: action.steps,
            embedding: response.data[0].embedding,
        });
        console.log(`Embedded: ${action.action}`);
    }
    fs_1.default.writeFileSync(outPath, JSON.stringify(embeddings, null, 2), 'utf8');
    console.log(`\nEmbeddings saved to ${outPath}`);
}
embedAll();
