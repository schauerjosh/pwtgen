// Loads and validates environment variables for the CLI tool
import dotenv from 'dotenv';

dotenv.config();

const requiredVars = [
  'JIRA_EMAIL',
  'JIRA_API_TOKEN',
  'JIRA_DOMAIN',
  'OPENAI_API_KEY',
];

const missing = requiredVars.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(`Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

export const config = {
  jiraEmail: process.env.JIRA_EMAIL!,
  jiraApiToken: process.env.JIRA_API_TOKEN!,
  jiraDomain: process.env.JIRA_DOMAIN!,
  openaiApiKey: process.env.OPENAI_API_KEY!,
};
