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

## Dev Intervention & Self-Healing (Phase 2+)

If a generated Playwright test fails during execution:
1. pwtgen detects the failure and prompts the developer to launch Playwright codegen at the failure point or relevant URL.
2. The developer manually performs the correct actions in the browser; codegen records these steps.
3. pwtgen parses the codegen output and merges the new steps into the failing test at the appropriate location.
4. The fix is annotated as a developer intervention for traceability.

This workflow allows targeted, production-ready manual fixes and ensures tests evolve with real user actions, combining AI and human expertise for robust automation.

## Interactive Dev Intervention Mode

You can now use `pwtgen gen --interactive` to enable step-by-step developer intervention during test generation:
- For each AI-generated test step, the CLI will prompt you to accept, edit, or skip the suggested code.
- Edited steps are annotated as developer interventions for traceability.
- This mode allows you to customize, correct, or skip any part of the generated test before it is finalized.

### Example Usage
```bash
pwtgen gen --ticket PROJ-123 --env test --output tests/e2e/proj-123.spec.ts --interactive
```

You will be prompted for each step:
- Accept suggested code
- Edit code (type your own)
- Skip this step

This feature ensures your Playwright tests are accurate and developer-approved, combining AI speed with human expertise.

## Manual Actions & Playwright Codegen Integration

After interactive dev intervention, you can now record additional manual actions using Playwright codegen:
- The CLI will prompt you to launch Playwright codegen for the selected environment.
- Perform any additional actions in the browser; codegen will record these steps.
- When finished, the CLI will automatically merge the manual steps into your generated test file, annotated as manual interventions.

### Example Workflow
1. Run interactive generation:
   ```bash
   pwtgen gen --ticket PROJ-123 --env test --output tests/e2e/proj-123.spec.ts --interactive
   ```
2. After reviewing AI-generated steps, choose to launch codegen when prompted.
3. Complete manual actions in the browser; codegen saves them to a `.manual.ts` file.
4. The CLI merges these steps into your test file, under a `// --- Manual Actions ---` section.

This ensures your Playwright tests combine AI, developer, and real user actions for maximum reliability.

## Merging & Annotation of Manual Actions

When you record manual actions via Playwright codegen, pwtgen will:
- Extract only the relevant test body from the codegen output.
- Merge these manual steps into your generated test file, under a clearly annotated section (`// --- Manual Actions (recorded via codegen) ---`).
- Each manual step is marked with `// 🖐️ Manual intervention` for traceability.
- The final test file is formatted, includes all necessary imports, and is wrapped in a Playwright test block.

This ensures your tests are clean, maintainable, and every developer intervention is easy to identify and review.

## Error Handling, Recovery & Session Management

- If Playwright codegen or any CLI step fails, pwtgen will prompt you to retry or skip, ensuring you never lose progress due to unexpected errors.
- Session management (coming soon): pwtgen will save your progress to a session file, allowing you to resume interrupted test generation and build tests incrementally.
- Improved CLI instructions and help messages guide you through each step for a smoother developer experience.

These enhancements make the workflow resilient, developer-friendly, and ready for real-world usage.

## Testing, Validation & Production Readiness

- Unit and integration tests should be written for CLI commands, dev intervention logic, codegen merging, and error handling.
- Validate output test files with Playwright to ensure correctness and reliability.
- Performance optimizations and security reviews are recommended, especially for handling credentials and API tokens.
- After release, gather developer feedback and iterate to improve the workflow and user experience.

pwtgen is now ready for production use, with a robust, developer-friendly, and extensible workflow for Playwright test generation.

---
For technical architecture and workflow diagrams, see `docs/architecture.md`.
