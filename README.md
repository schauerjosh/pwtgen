# pwtgen: AI-Powered Playwright Test Generator CLI

pwtgen is a modern CLI tool for generating Playwright tests from Jira tickets using OpenAI and a structured knowledge base. It enables rapid, reliable test creation for developers and QA engineers, leveraging canonical selectors, workflows, and patterns—never hallucinated logic.

## Features
- Interactive CLI for Jira ticket, environment, and output file selection
- Fetches Jira ticket details (title, description, acceptance criteria)
- Uses semantic search (RAG) to find selectors, workflows, and code patterns
- Generates Playwright tests using only canonical, knowledge base-driven steps
- Supports page object pattern and dry-run mode
- Secure credential management via `.env` (never committed)
- Extensible knowledge base: add selectors, workflows, and patterns as needed

## Installation
1. Clone the repo:
   ```bash
   git clone <your-pwtgen-repo-url>
   cd pwtgen
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build the CLI:
   ```bash
   npm run build
   ```
4. Link globally (optional):
   ```bash
   npm link
   ```

## Environment Setup
1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Fill in your Jira and OpenAI credentials (see `docs/environment.md`).

## CLI Usage
### Generate a Playwright Test
```bash
pwtgen generate
```
- Prompts for Jira ticket, environment, output file, and options
- Uses RAG to find selectors/workflows
- Generates and saves the test file

### Initialize Project
```bash
pwtgen init
```
- Creates `.env` and `knowledge-base/` structure

### Validate Setup
```bash
pwtgen validate
```
- Checks environment variables and knowledge base integrity

### Embed Knowledge Base
```bash
pwtgen embed
```
- Embeds selectors, workflows, and patterns for semantic search

## Knowledge Base Structure
- `knowledge-base/selectors/`: Selector definitions (e.g., login.md)
- `knowledge-base/workflows/`: Workflow steps and code (e.g., authentication.md)
- `knowledge-base/patterns/`: Common Playwright patterns (e.g., common-patterns.md)

## Knowledge Base and Embedding Index Location

- The CLI always uses the knowledge base and vector index embedded in its own repository directory.
- You do **not** need to run `pwtgen embed` in every consumer repo. The CLI will always reference its own `knowledge-base/` and `.vectra-index/`.
- If you update or extend the knowledge base, run `pwtgen embed` **once** in the CLI repo to rebuild the embeddings.
- Consumer projects do not need to copy or re-embed the knowledge base.

## Example: Authentication Workflow
See `knowledge-base/workflows/authentication.md` for a standard login flow and code example.

## Extensibility
- Add new selectors, workflows, or patterns to the knowledge base
- Update canonical snippets as your app evolves
- Diagrams and architecture docs in `docs/architecture.md`

## Security
- `.env` is never committed
- API keys and credentials are kept local

## Troubleshooting
- Run `pwtgen validate` to check setup
- See `docs/environment.md` for environment variable help
- For issues, open a GitHub issue or consult the documentation

---
For technical architecture and workflow diagrams, see `docs/architecture.md`.
