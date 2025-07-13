"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
// Loads and validates environment variables for the CLI tool
const dotenv_1 = __importDefault(require("dotenv"));
const inquirer_1 = __importDefault(require("inquirer"));
const fs_1 = __importDefault(require("fs"));
dotenv_1.default.config();
const requiredVars = [
    'JIRA_EMAIL',
    'JIRA_API_TOKEN',
    'JIRA_DOMAIN',
    'OPENAI_API_KEY',
];
const missing = requiredVars.filter((key) => !process.env[key]);
if (missing.length > 0) {
    (async () => {
        console.log(`Missing required environment variables: ${missing.join(', ')}`);
        const answers = await inquirer_1.default.prompt(missing.map((key) => ({
            type: 'input',
            name: key,
            message: `Enter value for ${key}:`,
            validate: (input) => input ? true : `${key} is required.`
        })));
        // Set process.env for this run
        for (const key of missing) {
            process.env[key] = answers[key];
        }
        // Ask to save to .env
        const { save } = await inquirer_1.default.prompt([
            {
                type: 'confirm',
                name: 'save',
                message: 'Save these values to your .env file for future runs?',
                default: true
            }
        ]);
        if (save) {
            let envContent = '';
            if (fs_1.default.existsSync('.env')) {
                envContent = fs_1.default.readFileSync('.env', 'utf8');
            }
            for (const key of missing) {
                const regex = new RegExp(`^${key}=.*$`, 'm');
                if (regex.test(envContent)) {
                    envContent = envContent.replace(regex, `${key}=${answers[key]}`);
                }
                else {
                    envContent += `\n${key}=${answers[key]}`;
                }
            }
            fs_1.default.writeFileSync('.env', envContent.trim() + '\n', 'utf8');
            console.log('Saved to .env');
        }
    })().then(() => { }, (err) => { console.error(err); process.exit(1); });
}
exports.config = {
    jiraEmail: process.env.JIRA_EMAIL,
    jiraApiToken: process.env.JIRA_API_TOKEN,
    jiraDomain: process.env.JIRA_DOMAIN,
    openaiApiKey: process.env.OPENAI_API_KEY,
};
