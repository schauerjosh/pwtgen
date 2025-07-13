import fs from 'fs';
import path from 'path';
import { OpenAI } from 'openai';
import { config } from './config';

const kbPath = path.join(__dirname, '../knowledgebase/actions.json');
const outPath = path.join(__dirname, '../knowledgebase/embeddings.json');
const actions = JSON.parse(fs.readFileSync(kbPath, 'utf8'));

const openai = new OpenAI({ apiKey: config.openaiApiKey });

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
  fs.writeFileSync(outPath, JSON.stringify(embeddings, null, 2), 'utf8');
  console.log(`\nEmbeddings saved to ${outPath}`);
}

embedAll();
