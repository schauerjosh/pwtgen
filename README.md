# pwtgen: AI-Powered Playwright Test Generator CLI

pwtgen is a modern CLI tool for generating Playwright tests from Jira tickets using OpenAI and a structured knowledge base. It enables rapid, reliable test creation for developers and QA engineers, leveraging canonical selectors, workflows, and patterns—never hallucinated logic.

## Quickstart (npm usage)

Install globally:
```bash
npm install -g pwtgen
```
Or run directly with npx (no install required):
```bash
npx pwtgen record
```

## First Command to Run

The most basic and recommended first command is:
```bash
pwtgen record
```
This will launch Playwright codegen, allowing you to record manual steps and create your first test file interactively.

## CLI Commands & Example Usage

- `pwtgen record`
  - Launches Playwright codegen and prompts you to record manual browser actions. The CLI guides you through saving these steps as a test file, merging them with any generated or existing tests.
  - Example:
    ```bash
    pwtgen record
    ```

- `pwtgen gen`
  - Generates a Playwright test from a Jira ticket using AI and your knowledge base. Prompts for ticket, environment, and output file.
  - Example:
    ```bash
    pwtgen gen
    ```

- `pwtgen gen --interactive`
  - Enables step-by-step developer intervention during test generation. For each AI-generated step, you can accept, edit, or skip the code.
  - Example:
    ```bash
    pwtgen gen --interactive
    ```

- `pwtgen gen --debug`
  - Runs the generator in debug mode, providing detailed output and logging for troubleshooting and advanced usage.
  - Example:
    ```bash
    pwtgen gen --debug
    ```

- `pwtgen init`
  - Initializes your project by creating a `.env` file and the required knowledge base directory structure.
  - Example:
    ```bash
    pwtgen init
    ```

- `pwtgen validate`
  - Checks your environment variables and knowledge base integrity.
  - Example:
    ```bash
    pwtgen validate
    ```

- `pwtgen embed`
  - Embeds selectors, workflows, and patterns from your knowledge base for semantic search.
  - Example:
    ```bash
    pwtgen embed
    ```

## Environment Setup
1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Fill in your Jira and OpenAI credentials (see `docs/environment.md`).

## Knowledge Base Structure
- `knowledge-base/selectors/`: Selector definitions (e.g., login.md)
- `knowledge-base/workflows/`: Workflow steps and code (e.g., authentication.md)
- `knowledge-base/patterns/`: Common Playwright patterns (e.g., common-patterns.md)

## Knowledge Base and Embedding Index Location

- The CLI always uses the knowledge base and vector index embedded in its own repository directory.
- You do **not** need to run `pwtgen embed` in every consumer repo. The CLI will always reference its own `knowledge-base/` and `.vectra-index/`.
- If you update or extend the knowledge base, run `pwtgen embed` **once** in the CLI repo to rebuild the embeddings.
- Consumer projects do not need to copy or re-embed the knowledge base.

## Error Handling, Recovery & Session Management

- If Playwright codegen or any CLI step fails, pwtgen will prompt you to retry or skip, ensuring you never lose progress due to unexpected errors.
- Session management (coming soon): pwtgen will save your progress to a session file, allowing you to resume interrupted test generation and build tests incrementally.
- Improved CLI instructions and help messages guide you through each step for a smoother developer experience.

## Testing, Validation & Production Readiness

- Validate output test files with Playwright to ensure correctness and reliability.
- Performance optimizations and security reviews are recommended, especially for handling credentials and API tokens.
- After release, gather developer feedback and iterate to improve the workflow and user experience.

---
For technical architecture and workflow diagrams, see `docs/architecture.md`.
