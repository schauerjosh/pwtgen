import fs from 'fs';
import path from 'path';
import axios from 'axios';

// TODO: Fill in with the 32 vProMedia knowledge base article URLs and titles
const articles: { title: string; url: string }[] = [
  // Example:
  // { title: 'How to Login', url: 'https://kb.vcreative.net/article/how-to-login' },
];

const outPath = path.join(__dirname, '../knowledgebase/articles.json');

async function fetchAllArticles() {
  const results = [];
  for (const article of articles) {
    try {
      const response = await axios.get(article.url);
      // Extract main content (customize selector as needed)
      const content = response.data;
      results.push({ ...article, content });
      console.log(`Fetched: ${article.title}`);
    } catch (err) {
      console.error(`Failed to fetch: ${article.title} (${article.url})`);
      results.push({ ...article, content: '' });
    }
  }
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf8');
  console.log(`\nArticles saved to ${outPath}`);
}

fetchAllArticles();
