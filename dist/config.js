"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
// Loads and validates environment variables for the CLI tool
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
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
exports.config = {
    jiraEmail: process.env.JIRA_EMAIL,
    jiraApiToken: process.env.JIRA_API_TOKEN,
    jiraDomain: process.env.JIRA_DOMAIN,
    openaiApiKey: process.env.OPENAI_API_KEY,
};
