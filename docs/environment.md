# Environment Setup for Playwright Test Generator CLI

This project requires several environment variables to be set for authentication and API access. Use a `.env` file in the project root (never commit this file) and copy the structure from `.env.example`.

## Required Variables

- `JIRA_EMAIL` — Your Jira account email
- `JIRA_API_TOKEN` — Your Jira API token
- `JIRA_DOMAIN` — Your Jira domain (e.g., `your-domain.atlassian.net`)
- `OPENAI_API_KEY` — Your OpenAI API key

## Setup Steps

1. Copy `.env.example` to `.env`:
   
   ```bash
   cp .env.example .env
   ```

2. Fill in your credentials in `.env`.

3. The CLI will validate these variables at startup and exit with an error if any are missing.

## Security
- Never commit your `.env` file or share your API keys.
- `.env` is already included in `.gitignore`.

## Troubleshooting
- If you see an error about missing environment variables, check your `.env` file for typos or missing values.
