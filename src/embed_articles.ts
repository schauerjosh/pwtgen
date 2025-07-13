import fs from 'fs';
import path from 'path';
import { OpenAI } from 'openai';
import { config } from './config';

const articlesPath = path.join(__dirname, '../knowledgebase/articles.json');
const outPath = path.join(__dirname, '../knowledgebase/article_embeddings.json');
const articles = JSON.parse(fs.readFileSync(articlesPath, 'utf8'));

const openai = new OpenAI({ apiKey: config.openaiApiKey });

async function embedAll() {
  const embeddings = [];
  for (const article of articles) {
    const text = `${article.title}\n${article.content}`;
    const response = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: text,
    });
    embeddings.push({
      title: article.title,
      url: article.url,
      embedding: response.data[0].embedding,
    });
    console.log(`Embedded: ${article.title}`);
  }
  fs.writeFileSync(outPath, JSON.stringify(embeddings, null, 2), 'utf8');
  console.log(`\nEmbeddings saved to ${outPath}`);
}

embedAll();
