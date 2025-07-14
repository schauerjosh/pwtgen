# pwtgen: AI-Powered Playwright Test Generator CLI

pwtgen is a CLI tool that uses OpenAI and Jira to generate production-quality Playwright tests based on Jira tickets. It is designed for developers and QA engineers to quickly scaffold Playwright tests in any codebase, with minimal manual effort and no hallucinated selectors or logic.

## Features
- Interactive CLI prompts for Jira ticket, environment, and test file location
- Fetches Jira ticket title, description, and acceptance criteria
- Uses OpenAI to generate Playwright test code using canonical workflows and selectors
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

## Step-by-Step: Generate a Playwright Test with pwtgen
1. In your target repo, run:
   ```bash
   pwtgen gen
   ```
2. Follow the prompts:
   - Enter the Jira ticket number
   - Select the environment (Production, QA, Smoke, TwoTest, Local)
   - Enter the path to save the Playwright test file (e.g., `tests/my-feature.spec.ts`)
   - Choose write mode (create new or append)
   - Provide any additional data if prompted (e.g., login credentials, spot data)
3. The CLI will:
   - Fetch Jira ticket details
   - Use semantic search and RAG to find canonical Playwright workflows and selectors
   - Use only the selected environment URL (never hardcoded)
   - Use canonical Playwright login and spot creation snippets from the knowledge base
   - Use valid mock data only if the Jira card requests it
   - Write the generated test to your specified file
4. Review the generated test file and run it with Playwright:
   ```bash
   npx playwright test <path-to-your-test-file>
   ```

## Recording Playwright Tests with pwtgen

You can use the `pwtgen record` command to interactively record browser actions and generate Playwright tests:

1. Run the record command:
   ```bash
   pwtgen record
   ```
2. Follow the prompts:
   - Select the environment (Production, QA, Smoke, TwoTest, Local)
   - Enter login credentials if needed
   - Provide spot data or choose to use mock data if relevant
   - Enter the path to save the Playwright test file
   - Choose write mode (create new or append)
3. The CLI will:
   - Launch a browser window to the selected environment URL
   - Record your actions as you interact with the site
   - Save the generated Playwright test to your specified file
4. Review and run your test:
   ```bash
   npx playwright test <path-to-your-test-file>
   ```

This workflow is ideal for quickly capturing real user flows and generating Playwright tests with minimal manual effort.

## Mock Data Usage for Playwright Test Generation
- Mock data files for all supported entities are located in `src/mock-data/`.
- Only the `valid` preset is used for each entity (e.g., `buildAdtypeData()`, `buildFirmData()`, etc.).
- The CLI/OpenAI logic calls the builder function for each entity and passes the resulting JSON object as mock data, never the file contents.
- Mock data is only included in the test generation prompt if the Jira card requests that specific data point (via required entities).
- Supported mock entities: adtype, firm, spot, spot-voices, spotFile, spotJobs, station, user.

**Example usage in code:**
```typescript
import { buildAdtypeData } from './mock-data/adtype-mock';
const adtypeData = buildAdtypeData(); // returns valid adtype mock as JSON
```

## Build & Commit
After making changes, run:
```bash
npm run build
```
Then commit and push your changes:
```bash
git add .
git commit -m "Update Playwright test generation logic and documentation"
git push
```

## Security
- Your `.env` file is never committed (see `.gitignore`)
- Do not share your API keys

## Updating
If you update the CLI code, just run:
```bash
npm run build
npm link
```

## Uninstalling
To remove the global link:
```bash
npm unlink -g pwtgen
```

## Troubleshooting
- If generated tests use hardcoded URLs or manual login/spot creation steps, ensure you have rebuilt and relinked the CLI after any source changes:
  ```bash
  rm -rf dist/
  npm run build
  npm link
  ```
- The CLI should always use the environment URL you select and canonical Playwright snippets from the knowledge base.
- If you see `command not found: pwtgen`, make sure you ran `npm link` after building.
- If you see missing environment variable errors, check your `.env` file.
  - If you see `Missing required environment variables: JIRA_EMAIL, JIRA_API_TOKEN, JIRA_DOMAIN, OPENAI_API_KEY` when running `pwtgen gen` in another repo, make sure you have the latest build of pwtgen. Run `npm run build` in your pwtgen directory, and re-link globally with `npm link` if needed. If you installed as a package, reinstall or update the package in your target repo. If you still see the error, ensure your `.env` file is present and correctly filled out in the target repo.
- For any other issues, see the documentation or open an issue.

---

For more details, see `docs/environment.md`.
