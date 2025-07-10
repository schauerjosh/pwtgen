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
- For any other issues, see the documentation or open an issue.

---

For more details, see `docs/environment.md`.
