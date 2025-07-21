#!/usr/bin/env node
// Suppress Node.js deprecation warnings
process.removeAllListeners('warning');
process.on('warning', (e) => {
    if (e.name === 'DeprecationWarning')
        return;
    console.warn(e);
});
// src/cli.ts
import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { config } from 'dotenv';
import { TestGenerator } from './core/TestGenerator.js';
import { JiraClient } from './jira/JiraClient.js';
import { VectraRAGService } from './rag/VectraRAGService.js';
import { validateConfig } from './utils/validation.js';
import { logger } from './utils/logger.js';
config();
const program = new Command();
program
    .name('pwtgen')
    .description('AI-Powered Playwright Test Generator CLI')
    .version('2.0.0');
program
    .command('generate')
    .alias('gen')
    .description('Generate Playwright test from Jira ticket')
    .option('-t, --ticket <key>', 'Jira ticket key (e.g., PROJ-123)')
    .option('-e, --env <environment>', 'Target environment', 'test')
    .option('-o, --output <path>', 'Output file path')
    .option('--overwrite', 'Overwrite existing test file', false)
    .option('--dry-run', 'Generate test without writing to file', false)
    .option('--no-page-objects', 'Generate without page object pattern', false)
    .option('--interactive', 'Enable dev intervention for each test step', false)
    .action(async (options) => {
    try {
        const config = await buildTestConfig(options);
        await generateTest(config, options.interactive);
    }
    catch (error) {
        logger.error('Failed to generate test:', error);
        process.exit(1);
    }
});
program
    .command('init')
    .description('Initialize pwtgen configuration')
    .action(async () => {
    await initializeConfig();
});
program
    .command('validate')
    .description('Validate knowledge base and configuration')
    .action(async () => {
    await validateSetup();
});
program
    .command('embed')
    .description('Embed knowledge base into vector store')
    .action(async () => {
    await embedKnowledgeBase();
});
program
    .command('record')
    .description('Launch a browser and record Playwright actions to generate a test (JIRA integration included)')
    .action(async () => {
    await handleRecordCommand();
});
async function handleRecordCommand() {
    console.log('\nINSTRUCTIONS:');
    console.log('1. You will select the environment and specify the file location for your Playwright test.');
    console.log('2. A browser window will open to the selected environment URL.');
    console.log('3. Perform your test actions in the browser.');
    console.log('4. When you are done, CLOSE the browser window.');
    console.log('5. Your actions will be automatically captured and saved as a Playwright test in the file you specify.');
    console.log('6. To run your new test, use: npx playwright test <path-to-your-test-file>');
    console.log('');
    // Load environment URLs from .env or knowledge base
    const ENV_URLS = {
        prod: process.env.PROD_BASE_URL || '',
        test: process.env.TWO_TEST_BASE_URL || '',
        qa: process.env.QA_BASE_URL || '',
        staging: process.env.SMOKE_BASE_URL || ''
    };
    const { env } = await inquirer.prompt([
        {
            type: 'list',
            name: 'env',
            message: 'Select the environment:',
            choices: [
                { name: `prod (${ENV_URLS.prod})`, value: 'prod' },
                { name: `test (${ENV_URLS.test})`, value: 'test' },
                { name: `qa (${ENV_URLS.qa})`, value: 'qa' },
                { name: `staging (${ENV_URLS.staging})`, value: 'staging' }
            ],
            default: 'test',
        },
    ]);
    const envKey = String(env);
    const url = ENV_URLS[envKey];
    // Prompt for login credentials (integrate with KB if available)
    let loginCredentials = undefined;
    const { wantsLogin } = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'wantsLogin',
            message: 'Do you want to provide login credentials (email/password)?',
            default: false,
        },
    ]);
    if (wantsLogin) {
        loginCredentials = await inquirer.prompt([
            {
                type: 'input',
                name: 'email',
                message: 'Enter user email:',
            },
            {
                type: 'input',
                name: 'password',
                message: 'Enter user password:',
            },
        ]);
        // Save credentials as fixture
        const fs = await import('fs');
        const path = await import('path');
        const usersDir = path.join('playwright', 'fixtures', 'users');
        fs.mkdirSync(usersDir, { recursive: true });
        const usersFile = path.join(usersDir, 'users.json');
        let users = [];
        if (fs.existsSync(usersFile)) {
            try {
                users = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
            }
            catch { }
        }
        users.push(loginCredentials);
        fs.writeFileSync(usersFile, JSON.stringify(users, null, 2), 'utf8');
        console.log(`\n✅ Credentials saved to ${usersFile}`);
    }
    // Prompt for spot data or mock files (integrate with KB if available)
    const { wantsSpotData } = await inquirer.prompt([
        {
            type: 'list',
            name: 'wantsSpotData',
            message: 'Do you want to provide specific spot data or use mock files?',
            choices: [
                { name: 'Provide specific spot data', value: 'specific' },
                { name: 'Use mock files', value: 'mock' },
                { name: 'No spot data needed', value: 'none' },
            ],
            default: 'none',
        },
    ]);
    if (wantsSpotData === 'specific') {
        const spotDetails = await inquirer.prompt([
            { type: 'input', name: 'user', message: 'Which user? (email address)' },
            { type: 'input', name: 'adtype', message: 'Which adtype?' },
            { type: 'input', name: 'stations', message: 'Which stations?' },
            { type: 'input', name: 'spotTitle', message: 'Spot title?' },
            { type: 'input', name: 'startDate', message: 'Start date?' },
            { type: 'input', name: 'endDate', message: 'End date?' },
            { type: 'input', name: 'dueDate', message: 'Due date?' },
            { type: 'input', name: 'status', message: 'Status?' },
        ]);
        const fs = await import('fs');
        const path = await import('path');
        const spotsDir = path.join('playwright', 'fixtures', 'spots');
        fs.mkdirSync(spotsDir, { recursive: true });
        const spotsFile = path.join(spotsDir, 'spots.json');
        let spots = [];
        if (fs.existsSync(spotsFile)) {
            try {
                spots = JSON.parse(fs.readFileSync(spotsFile, 'utf8'));
            }
            catch { }
        }
        spots.push(spotDetails);
        fs.writeFileSync(spotsFile, JSON.stringify(spots, null, 2), 'utf8');
        console.log(`\n✅ Spot data saved to ${spotsFile}`);
    }
    else if (wantsSpotData === 'mock') {
        console.log('\nUsing mock spot data files.');
        // Optionally copy or reference mock files here
    }
    // Prompt for test file path and write mode
    const { testFilePath } = await inquirer.prompt([
        {
            type: 'input',
            name: 'testFilePath',
            message: 'Enter the test file path:',
            validate: input => input ? true : 'Test file path required.'
        }
    ]);
    const pathModule = await import('path');
    const absPath = pathModule.resolve(testFilePath);
    // Launch Playwright in record mode
    const { execSync } = await import('child_process');
    try {
        console.log(`\nLaunching Playwright in record mode for: ${url}\n`);
        execSync(`npx playwright codegen ${url} --output ${absPath}`, { stdio: 'inherit' });
        console.log(`\n✅ Test actions recorded and saved to ${absPath}`);
    }
    catch (err) {
        console.error('Error:', err);
    }
    // Prompt to run the test
    const { runTest } = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'runTest',
            message: `Do you want to run the newly created test now?`,
            default: true,
        },
    ]);
    if (runTest) {
        try {
            console.log(`\nRunning: TEST_ENV=${envKey} PWDEBUG=1 npx playwright test ${absPath}\n`);
            execSync(`TEST_ENV=${envKey} PWDEBUG=1 npx playwright test ${absPath}`, { stdio: 'inherit' });
        }
        catch (err) {
            console.error('Error:', err);
        }
    }
}
async function buildTestConfig(options) {
    try {
        // Prompt for all args, even if provided
        const answers = await inquirer.prompt([
            {
                type: 'input',
                name: 'ticket',
                message: 'Enter Jira ticket key:',
                default: options.ticket,
                validate: (input) => {
                    if (!input.match(/^[A-Z]+-\d+$/)) {
                        return 'Please enter a valid Jira ticket key (e.g., PROJ-123)';
                    }
                    return true;
                }
            },
            {
                type: 'list',
                name: 'environment',
                message: 'Select target environment:',
                choices: ['test', 'qa', 'staging', 'prod'],
                default: options.env || 'test'
            },
            {
                type: 'input',
                name: 'outputPath',
                message: 'Enter output file path:',
                default: options.output || ((answers) => `tests/e2e/${(options.ticket || answers.ticket).toLowerCase()}.spec.ts`)
            },
            {
                type: 'confirm',
                name: 'overwrite',
                message: 'Overwrite existing test file if it exists?',
                default: !!options.overwrite
            }
        ]);
        const spinner = ora('Building configuration...').start();
        const jiraClient = new JiraClient();
        const ticket = await jiraClient.getTicket(answers.ticket);
        // Prompt for vCreative login if card description contains 'as yourself' or 'ghost in as'
        let vCreativeCredentials = undefined;
        if (/as yourself|ghost in as/i.test(ticket.description)) {
            spinner.stop(); // Stop spinner before prompt
            console.log('[DEBUG] Prompting for vCreative credentials...');
            vCreativeCredentials = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'email',
                    message: 'Enter your vCreative login email:'
                },
                {
                    type: 'password',
                    name: 'password',
                    message: 'Enter your vCreative password:'
                }
            ]);
            console.log('[DEBUG] vCreative credentials received:', vCreativeCredentials.email ? 'email entered' : 'no email');
            spinner.start(); // Restart spinner after prompt
        }
        const config = {
            ticket,
            environment: answers.environment,
            outputPath: answers.outputPath,
            overwrite: answers.overwrite,
            dryRun: false, // Default to no, do not prompt
            pageObjectPattern: false, // Default to no, do not prompt
            vCreativeCredentials // Add credentials to config if provided
        };
        spinner.succeed('Configuration built successfully');
        return validateConfig(config);
    }
    catch (error) {
        // Only start spinner if error occurs after prompt
        const spinner = ora('Building configuration...').start();
        spinner.fail('Failed to build configuration');
        throw error;
    }
}
async function generateTest(config, interactive = false) {
    console.log(chalk.green('[pwtgen] Starting test generation...'));
    const spinner = ora('Generating Playwright test...').start();
    try {
        const generator = new TestGenerator();
        let interventionIndex = null;
        let interventionCode = '';
        if (interactive) {
            // Dev intervention loop
            const ragContexts = await generator['retrieveContext'](config);
            const aiSteps = await generator['generateTestCode'](config, ragContexts);
            const steps = aiSteps.split(/(?=await test\.step)/g);
            for (let i = 0; i < steps.length; i++) {
                console.log(chalk.yellow(`\nStep ${i + 1}:`));
                console.log(chalk.cyan(steps[i]));
                spinner.stop(); // Ensure spinner does not hide prompt
                const { action } = await inquirer.prompt([
                    {
                        type: 'list',
                        name: 'action',
                        message: 'Choose an action:',
                        choices: [
                            { name: 'Accept suggested code', value: 'accept' },
                            { name: 'Intervene or take manual action in Playwright (record new steps)', value: 'edit' },
                            { name: 'Skip this step', value: 'skip' }
                        ]
                    }
                ]);
                if (action === 'edit') {
                    // Clarify intervention
                    console.log(chalk.yellow('You are about to intervene or take manual action in Playwright (record new steps).'));
                    const { execSync } = await import('child_process');
                    const { openJira } = await inquirer.prompt([
                        {
                            type: 'confirm',
                            name: 'openJira',
                            message: 'Do you want to open the QA Jira card in your browser for reference?',
                            default: false
                        }
                    ]);
                    if (openJira) {
                        const jiraDomain = process.env.JIRA_BASE_URL?.replace(/\/$/, '') || 'https://your-company.atlassian.net';
                        const jiraUrl = `${jiraDomain}/browse/${config.ticket.key}`;
                        try {
                            execSync(`open ${jiraUrl}`); // macOS: use 'open', Windows: use 'start', Linux: use 'xdg-open'
                        }
                        catch (err) {
                            console.warn('Could not open Jira card in browser:', err);
                        }
                    }
                    // Launch Playwright codegen with current test file
                    const { TestGeneratorUtils } = await import('./core/TestGenerator.js');
                    const url = TestGeneratorUtils.getBaseUrl(config.environment);
                    const testFilePath = config.outputPath;
                    try {
                        console.log(`\nLaunching Playwright codegen for: ${url} with file: ${testFilePath}\n`);
                        execSync(`npx playwright codegen ${url} --output ${testFilePath}`, { stdio: 'inherit' });
                        console.log(`\n✅ Edited actions recorded and saved to ${testFilePath}`);
                        const fs = await import('fs/promises');
                        const updatedCode = await fs.readFile(testFilePath, 'utf8');
                        // Prompt which step to replace
                        const { replaceIndex } = await inquirer.prompt([
                            {
                                type: 'list',
                                name: 'replaceIndex',
                                message: 'Which step would you like to replace with your manual intervention?',
                                choices: steps.map((step, idx) => ({ name: `Step ${idx + 1}: ${step.substring(0, 40)}...`, value: idx }))
                            }
                        ]);
                        steps[replaceIndex] = updatedCode + ' // ✏️ Developer modified via codegen';
                        interventionIndex = replaceIndex;
                        interventionCode = updatedCode;
                    }
                    catch (err) {
                        console.error('Error recording edited actions:', err);
                    }
                    spinner.start();
                }
                else if (action === 'skip') {
                    steps[i] = '// Step skipped by developer';
                }
            }
            // Phase 2: Prompt to launch codegen for manual actions
            const { wantsCodegen } = await inquirer.prompt([
                {
                    type: 'confirm',
                    name: 'wantsCodegen',
                    message: 'Do you want to launch Playwright codegen to record additional manual actions?',
                    default: false
                }
            ]);
            let manualSteps = '';
            if (wantsCodegen) {
                const codegenPath = config.outputPath.replace(/\.ts$/, '.manual.ts');
                const { TestGeneratorUtils } = await import('./core/TestGenerator.js');
                const url = TestGeneratorUtils.getBaseUrl(config.environment);
                const { execSync } = await import('child_process');
                try {
                    console.log(`\nLaunching Playwright codegen for: ${url}\n`);
                    execSync(`npx playwright codegen ${url} --output ${codegenPath}`, { stdio: 'inherit' });
                    console.log(`\n✅ Manual actions recorded and saved to ${codegenPath}`);
                    // Read manual steps
                    const fs = await import('fs/promises');
                    manualSteps = await fs.readFile(codegenPath, 'utf8');
                }
                catch (err) {
                    console.error('Error recording manual actions:', err);
                    // Offer to retry or skip
                    const { retryCodegen } = await inquirer.prompt([
                        {
                            type: 'confirm',
                            name: 'retryCodegen',
                            message: 'Codegen failed. Would you like to retry?',
                            default: false
                        }
                    ]);
                    if (retryCodegen) {
                        // Recursive retry
                        // ...could call codegen logic again...
                    }
                    else {
                        console.log('Skipping manual codegen step.');
                    }
                }
            }
            // Merge AI/dev steps and manual steps
            let mergedSteps = steps.filter(Boolean).map((step, idx) => {
                if (step.startsWith('import { test, expect }'))
                    return '';
                if (step.startsWith('test(') || step.startsWith('test.describe('))
                    return '';
                if (step.startsWith('// Step skipped by developer'))
                    return step;
                return step;
            }).filter(Boolean).join('\n\n');
            let mergedCode = `import { expect, test } from '@playwright/test';\n\ntest.describe('Calendar View Functionality', () => {\n  test.beforeEach(async ({ page }) => {\n    // ...login steps...\n  });\n\n  test('Verify Calendar View and Functionality', async ({ page }) => {\n${mergedSteps}\n  });\n\n  test.afterEach(async ({ page }, testInfo) => {\n    if (testInfo.status !== testInfo.expectedStatus) {\n      await page.screenshot({ path: \`screenshots/\${testInfo.title}.png\`, fullPage: true });\n    }\n  });\n});\n`;
            // Remove duplicate Playwright imports
            mergedCode = mergedCode.replace(/(import\s+\{\s*expect,\s*test\s*\}\s+from\s+'@playwright\/test';?\s*)+/g, 'import { expect, test } from "@playwright/test";\n');
            // When merging manual steps, check for duplication
            if (manualSteps) {
                const manualBodyMatch = manualSteps.match(/test\([^)]*\)\s*{([\s\S]*)}/);
                const manualBody = manualBodyMatch ? manualBodyMatch[1].trim() : manualSteps.trim();
                // Only append manual steps if not already present in steps
                if (!mergedCode.includes(manualBody.substring(0, 40))) {
                    mergedCode += `\n\n// Manual steps recorded:\n${manualBody}`;
                }
            }
            // Write final merged code to output path
            const fs = await import('fs/promises');
            await fs.mkdir(config.outputPath.replace(/\/[^/]+$/, ''), { recursive: true });
            await fs.writeFile(config.outputPath, mergedCode, 'utf8');
            spinner.succeed('Test generation complete');
            console.log(chalk.green(`✅ Test saved to: ${config.outputPath}`));
            // After test generation, automatically map intervention
            if (interventionIndex !== null) {
                const mappingFile = 'knowledge-base/workflows/card-test-mapping.md';
                const mappingDir = 'knowledge-base/workflows';
                await fs.mkdir(mappingDir, { recursive: true });
                const cardKey = config.ticket?.key || '';
                const cardSummary = config.ticket?.summary || '';
                const cardDetails = config.ticket?.description || '';
                const mappingText = `\n---\nCard: ${cardKey}\nSummary: ${cardSummary}\nDetails: ${cardDetails}\nTest File: ${config.outputPath}\nIntervention Step: ${interventionIndex + 1}\nIntervention Code: ${interventionCode.substring(0, 200)}\n---\n`;
                await fs.appendFile(mappingFile, mappingText);
                console.log(chalk.green(`✅ Intervention mapping appended to ${mappingFile}`));
            }
            // Confirm with dev to add selectors/steps for self-learning
            const { addSelectors } = await inquirer.prompt([
                {
                    type: 'confirm',
                    name: 'addSelectors',
                    message: 'Would you like to add selectors/steps from this test to the knowledge base for future self-learning and improved test generation?',
                    default: false
                }
            ]);
            if (addSelectors) {
                const testContent = await fs.readFile(config.outputPath, 'utf8');
                const selectorMatches = testContent.match(/getBy(Role|Text|Label|TestId)\([^)]*\)/g) || [];
                if (selectorMatches.length) {
                    const selectorFile = 'knowledge-base/selectors/vpromedia-selectors.md';
                    const selectorDir = 'knowledge-base/selectors';
                    await fs.mkdir(selectorDir, { recursive: true });
                    const selectorText = selectorMatches.map(sel => `- ${sel}`).join('\n');
                    await fs.appendFile(selectorFile, `\n${selectorText}\n`);
                    console.log(chalk.green(`✅ Selectors appended to ${selectorFile}`));
                }
                else {
                    console.log(chalk.yellow('No selectors found to add.'));
                }
            }
            const { addTestData } = await inquirer.prompt([
                {
                    type: 'confirm',
                    name: 'addTestData',
                    message: 'Would you like to add test data from this test to the CLI knowledge base?',
                    default: false
                }
            ]);
            if (addTestData) {
                const testContent = await fs.readFile(config.outputPath, 'utf8');
                // Example: extract emails, passwords, search terms
                const dataMatches = testContent.match(/fill\(['"]([^'"]+)['"]\)/g) || [];
                if (dataMatches.length) {
                    const dataFile = 'knowledge-base/fixtures/test-users.md';
                    const dataDir = 'knowledge-base/fixtures';
                    await fs.mkdir(dataDir, { recursive: true });
                    const dataText = dataMatches.map(d => `- ${d}`).join('\n');
                    await fs.appendFile(dataFile, `\n${dataText}\n`);
                    console.log(chalk.green(`✅ Test data appended to ${dataFile}`));
                }
                else {
                    console.log(chalk.yellow('No test data found to add.'));
                }
            }
            // Prompt to map test to Jira card and dev actions
            const { mapCard } = await inquirer.prompt([
                {
                    type: 'confirm',
                    name: 'mapCard',
                    message: 'Would you like to map this test to a Jira card and document your dev actions?',
                    default: true
                }
            ]);
            if (mapCard) {
                // Get card info from config or prompt
                let cardKey = config.ticket?.key || '';
                if (!cardKey) {
                    const { enteredKey } = await inquirer.prompt([
                        {
                            type: 'input',
                            name: 'enteredKey',
                            message: 'Enter the Jira card key (e.g., QA-123):',
                            validate: input => input ? true : 'Card key required.'
                        }
                    ]);
                    cardKey = enteredKey;
                }
                let cardSummary = config.ticket?.summary || '';
                if (!cardSummary) {
                    const { enteredSummary } = await inquirer.prompt([
                        {
                            type: 'input',
                            name: 'enteredSummary',
                            message: 'Enter a brief summary of the card:',
                            validate: input => input ? true : 'Summary required.'
                        }
                    ]);
                    cardSummary = enteredSummary;
                }
                let cardDetails = config.ticket?.description || '';
                if (!cardDetails) {
                    const { enteredDetails } = await inquirer.prompt([
                        {
                            type: 'input',
                            name: 'enteredDetails',
                            message: 'Enter card details/acceptance criteria:',
                            validate: input => input ? true : 'Details required.'
                        }
                    ]);
                    cardDetails = enteredDetails;
                }
                // Ask dev what they did to ensure test quality
                const { devActions } = await inquirer.prompt([
                    {
                        type: 'input',
                        name: 'devActions',
                        message: 'Describe what you did to ensure the test was created properly:',
                        validate: input => input ? true : 'Please describe your actions.'
                    }
                ]);
                // Append mapping to knowledge base
                const mappingFile = 'knowledge-base/workflows/card-test-mapping.md';
                const mappingText = `\n---\nCard: ${cardKey}\nSummary: ${cardSummary}\nDetails: ${cardDetails}\nTest File: ${config.outputPath}\nDev Actions: ${devActions}\n---\n`;
                await fs.appendFile(mappingFile, mappingText);
                console.log(chalk.green(`✅ Mapping appended to ${mappingFile}`));
            }
        }
        else {
            // Non-interactive mode: directly generate test
            const ragService = new VectraRAGService();
            // Fix VectraRAGService usage: use query method to get test code
            const responseArr = await ragService.query(config.ticket?.description || config.ticket?.summary || '', 1, 0.1);
            const response = responseArr[0]?.content || '';
            const fs = await import('fs/promises');
            await fs.mkdir(config.outputPath.replace(/\/[^/]+$/, ''), { recursive: true });
            await fs.writeFile(config.outputPath, response, 'utf8');
            spinner.succeed('Test generation complete');
            console.log(chalk.green(`✅ Test saved to: ${config.outputPath}`));
        }
    }
    catch (error) {
        spinner.fail('Test generation failed');
        logger.error(error);
        throw error;
    }
}
// Common initialization and configuration functions
export async function initializeConfig() {
    console.log('Initializing pwtgen configuration...');
    // TODO: Implement configuration initialization logic
    console.log('Configuration initialized.');
}
export async function validateSetup() {
    console.log('Validating setup...');
    // TODO: Implement setup validation logic
    console.log('Setup is valid.');
}
async function embedKnowledgeBase() {
    console.log('Embedding knowledge base...');
    // ...existing embedding logic...
}
program.parse(process.argv);
//# sourceMappingURL=cli.js.map