#!/bin/bash
# This script will delete all unreferenced files and folders in the project.
# Please review before running in production.

# Remove legacy/unused top-level files
rm -f Archive.zip Archive\ 2.zip .DS_Store test-2 RAGService.ts

# Remove old/unused scripts
rm -f src/main.ts src/openai.ts src/jira.ts src/index.ts src/mcp.ts src/mcp-record.ts src/mcp-record-unified.ts src/spot-view.html src/spotPresets.ts src/embed_articles.ts src/embed_kb.ts src/embed_templates.ts src/fetch_articles.ts src/hash_utils.ts

# Remove old/unused folders
rm -rf src/mock-data src/page-objects src/playwright src/utils src/types dist

# Remove old/unused knowledge base
rm -rf knowledgebase

# Remove any other unreferenced files/folders as needed

# Done
