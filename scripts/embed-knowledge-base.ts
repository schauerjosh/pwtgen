#!/usr/bin/env tsx
// scripts/embed-knowledge-base.ts
import { config } from 'dotenv';
import { VectraRAGService } from '../src/rag/VectraRAGService.js';

// Load environment variables
config();

async function main() {
  try {
    const rag = new VectraRAGService();
    await rag.ingestKnowledgeBase();
    console.log('\n✅ Knowledge base embedding completed successfully!');
  } catch (error) {
    console.error('❌ Failed to embed knowledge base:', error);
    process.exit(1);
  }
}

main();
