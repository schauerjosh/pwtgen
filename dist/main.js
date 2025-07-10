"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = main;
const inquirer_1 = __importDefault(require("inquirer"));
const jira_1 = require("./jira");
const openai_1 = require("./openai");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
async function main() {
    // Prompt for Jira ticket number only
    const { jiraTicket } = await inquirer_1.default.prompt([
        {
            type: 'input',
            name: 'jiraTicket',
            message: 'Enter the Jira ticket number:',
            validate: (input) => input ? true : 'Jira ticket number is required.'
        }
    ]);
    // Fetch Jira ticket data and return the title
    try {
        const issue = await (0, jira_1.fetchJiraIssue)(jiraTicket);
        const title = issue.fields.summary;
        let description = '';
        if (typeof issue.fields.description === 'string') {
            description = issue.fields.description;
        }
        else if (issue.fields.description && issue.fields.description.content) {
            description = issue.fields.description.content.map((c) => c.content?.map((cc) => cc.text).join(' ')).join(' ');
        }
        const acceptanceCriteria = issue.fields.customfield_10031 ? JSON.stringify(issue.fields.customfield_10031) : undefined;
        console.log(`\nTitle of ${jiraTicket}: ${title}`);
        // Generate Playwright test using OpenAI
        console.log('\nGenerating Playwright test using OpenAI...');
        const testCode = await (0, openai_1.generatePlaywrightTest)({
            title,
            description,
            acceptanceCriteria
        });
        console.log('\nGenerated Playwright Test:\n');
        console.log(testCode);
        // Prompt for file path
        const defaultPath = path_1.default.join('tests', `${jiraTicket}.spec.ts`);
        const { testPath } = await inquirer_1.default.prompt([
            {
                type: 'input',
                name: 'testPath',
                message: 'Path to save the test file:',
                default: defaultPath,
                validate: (input) => input ? true : 'Test file path is required.'
            }
        ]);
        const absPath = path_1.default.resolve(testPath);
        let writeMode = 'new';
        if (fs_1.default.existsSync(absPath)) {
            const { append } = await inquirer_1.default.prompt([
                {
                    type: 'confirm',
                    name: 'append',
                    message: `File ${testPath} exists. Append to it? (No will overwrite)`,
                    default: true
                }
            ]);
            writeMode = append ? 'append' : 'new';
        }
        // Ensure directory exists
        fs_1.default.mkdirSync(path_1.default.dirname(absPath), { recursive: true });
        if (writeMode === 'new') {
            // Write full test file
            fs_1.default.writeFileSync(absPath, testCode, 'utf8');
            console.log(`\nTest file created: ${absPath}`);
        }
        else {
            // Append only the test() block
            const testBlockMatch = testCode.match(/(test\s*\(.*[\s\S]*)/);
            if (testBlockMatch) {
                fs_1.default.appendFileSync(absPath, '\n' + testBlockMatch[1], 'utf8');
                console.log(`\nTest block appended to: ${absPath}`);
            }
            else {
                console.error('Could not find a test() block to append.');
            }
        }
    }
    catch (err) {
        console.error('Error:', err.message);
        process.exit(1);
    }
}
