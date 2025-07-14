# pwtgen: AI-Powered Playwright Test Generator CLI

pwtgen is a CLI tool that uses OpenAI and Jira to generate production-quality Playwright tests based on Jira tickets. It is designed for developers and QA engineers to quickly scaffold Playwright tests in any codebase, with minimal manual effort and no hallucinated selectors or logic.

## Features
- Interactive CLI prompts for Jira ticket, user role, and test file location
- Fetches Jira ticket title, description, and acceptance criteria
- Uses OpenAI to generate Playwright test code
- Lets you choose where to save the test (new file or append to existing)
- Works in any repo: you can generate tests directly into your own project
- Keeps your credentials secure with a `.env` file (never committed)

## Installation (Local/Global)
1. Clone or download this repo:
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
4. Link globally (for system-wide use):
   ```bash
   npm link
   ```

## Environment Setup
1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Fill in your Jira and OpenAI credentials in `.env` (see `docs/environment.md` for details).

## Usage in Any Repo
You can run `pwtgen` from any directory, including inside your own project (e.g., vSuitePlatform):

1. In your target repo, run:
   ```bash
   pwtgen gen
   ```
2. Follow the prompts:
   - Enter the Jira ticket number
   - When asked for the test file path, enter a path inside your current repo (e.g., `tests/my-feature.spec.ts` or `src/__tests__/integration/my-feature.spec.ts`)
   - The CLI will create any missing directories and write the test there
   - If the file exists, you can choose to append or overwrite

**Example:**
```bash
cd ~/projects/vSuitePlatform
pwtgen gen
# When prompted, enter: tests/new-feature.spec.ts
```

## Using pwtgen as a Dependency in Another Project

You can install `pwtgen` directly into your own project as a dev dependency:

### 1. Install via npm (from GitHub)
Replace `<your-username>` and `<repo>` with your GitHub details if private, or use the public repo URL:
```bash
npm install --save-dev github:schauerjosh/pwtgen
```

Or, if you publish to npm, use:
```bash
npm install --save-dev pwtgen
```

### 2. Add Environment Variables
Copy the `.env.example` from `pwtgen` to your project root and rename it to `.env`. Fill in the required variables:
- `JIRA_EMAIL`
- `JIRA_API_TOKEN`
- `JIRA_DOMAIN`
- `OPENAI_API_KEY`

### 3. Run the CLI
You can run the CLI using npx:
```bash
npx pwtgen gen
```
Or add a script to your `package.json`:
```json
"scripts": {
  "pwtgen": "pwtgen gen"
}
```
Then run:
```bash
npm run pwtgen
```

## MCP Server & Session Recording Workflow

### 1. Start the MCP Server
```bash
pwtgen mcp
```
- Select the browser (chromium, firefox, webkit) and port (default: 8931) when prompted.
- The MCP server will start and display a sessionId in the terminal.
- The sessionId is automatically saved to `.mcp-sessionid` in your project root.
- You will see a message like:
  ```
  SessionId detected and saved to .mcp-sessionid: <sessionId>
  MCP server started. SessionId: <sessionId>
  Connect to http://localhost:8931/sse?sessionId=<sessionId>
  ```

### 2. Record Browser Actions
```bash
pwtgen mcp:record
```
- Enter the MCP server port (default: 8931) when prompted.
- The CLI will auto-detect the sessionId from `.mcp-sessionid` (or you can enter it manually).
- The CLI connects to the MCP SSE endpoint and records browser actions/events.
- Interact with the browser as needed.
- When finished, press Enter at the prompt to stop recording.
- The recorded session is saved to `mcp-session.json` in your project root.

### 3. Generate Playwright Tests (coming soon)
- Use the recorded session to generate Playwright tests via OpenAI (feature in development).

## One-Command MCP Workflow: Record & Generate Playwright Test

### 1. Run the Unified Command
```bash
pwtgen mcp:record
```
- Select the browser (chromium, firefox, webkit), port (default: 8931), and enter the URL you want to test.
- Specify where to save the generated Playwright test (default: tests/generated.spec.ts).

### 2. Automated Steps
- The CLI will:
  - Start the MCP server
  - Launch the selected browser and navigate to your test URL
  - Start recording your browser actions automatically

### 3. Record Your Actions
- Interact with the site in the launched browser as you normally would.
- When finished, return to the CLI and press Enter to stop recording.

### 4. Test Generation
- The CLI will:
  - Save the recorded session to `mcp-session.json`
  - Automatically generate a Playwright test using OpenAI
  - Save the test to your specified file path

### 5. Review & Run Your Test
- Open the generated test file in your repo and review the code.
- Run the test using Playwright as you would any other test.

## Embedding & Semantic Search Enhancements
- The embedding script now extracts and embeds relevant keywords/tags (selectors, workflows, business actions, synonyms like "as Demo" for login) for each article.
- Content is normalized and deduplicated for more accurate embeddings.
- Tags/metadata are stored with embeddings for improved custom scoring and filtering.
- Synonym expansion ensures queries like "login as Demo" are matched accurately.

### How to Update Embeddings
Run the following command to refresh embeddings after updating knowledge base articles:
```bash
npx ts-node src/embed_articles.ts
```
This will regenerate `article_embeddings.json` with improved accuracy for CLI and semantic search.

## Build & Commit
After making changes, run:
```bash
npm run build
```
Then commit and push your changes:
```bash
git add .
git commit -m "Update semantic search and RAG logic"
git push
```

## Security
- Your `.env` file is never committed (see `.gitignore`)
- Do not share your API keys

## Updating
If you update the CLI code, just run:
```bash
npm run build
```

## Uninstalling
To remove the global link:
```bash
npm unlink -g pwtgen
```

## Troubleshooting
- If you see `command not found: pwtgen`, make sure you ran `npm link` after building.
- If you see missing environment variable errors, check your `.env` file.
  - If you see `Missing required environment variables: JIRA_EMAIL, JIRA_API_TOKEN, JIRA_DOMAIN, OPENAI_API_KEY` when running `pwtgen gen` in another repo, make sure you have the latest build of pwtgen. Run `npm run build` in your pwtgen directory, and re-link globally with `npm link` if needed. If you installed as a package, reinstall or update the package in your target repo. If you still see the error, ensure your `.env` file is present and correctly filled out in the target repo.
- For any other issues, see the documentation or open an issue.

---

For more details, see `docs/environment.md`.
