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
    .action(async (options) => {
    try {
        const config = await buildTestConfig(options);
        await generateTest(config);
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
    const { testFilePath, mode } = await inquirer.prompt([
        {
            type: 'input',
            name: 'testFilePath',
            message: 'Path to save the Playwright test file:',
            default: 'playwright/test/test-1.spec.ts'
        },
        {
            type: 'list',
            name: 'mode',
            message: 'Write mode:',
            choices: [
                { name: 'Create new file', value: 'new' },
                { name: 'Append to existing file', value: 'append' }
            ],
            default: 'new'
        }
    ]);
    const pathModule = await import('path');
    const absPath = pathModule.resolve(testFilePath);
    const writeMode = mode;
    // Launch Playwright in record mode
    const { execSync } = await import('child_process');
    try {
        console.log(`\nLaunching Playwright in record mode for: ${url}\n`);
        execSync(`npx playwright codegen ${url} --output ${absPath}`, { stdio: 'inherit' });
        console.log(`\n✅ Test actions recorded and saved to ${absPath}`);
    }
    catch (err) {
        if (err instanceof Error) {
            console.error('Error recording the test:', err.message);
        }
        else {
            console.error('Error recording the test:', err);
        }
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
            if (err instanceof Error) {
                console.error('Error running the test:', err.message);
            }
            else {
                console.error('Error running the test:', err);
            }
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
        const config = {
            ticket,
            environment: answers.environment,
            outputPath: answers.outputPath,
            overwrite: answers.overwrite,
            dryRun: false, // Default to no, do not prompt
            pageObjectPattern: false // Default to no, do not prompt
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
async function generateTest(config) {
    const spinner = ora('Generating Playwright test...').start();
    try {
        const generator = new TestGenerator();
        const result = await generator.generate(config);
        if (config.dryRun) {
            spinner.succeed('Test generated (dry run)');
            console.log(chalk.cyan('\n--- Generated Test ---'));
            console.log(result.content);
            console.log(chalk.cyan('--- End Generated Test ---\n'));
        }
        else {
            spinner.succeed(`Test generated successfully: ${chalk.green(result.filePath)}`);
            console.log(chalk.blue(`\n📋 Ticket: ${config.ticket.key} - ${config.ticket.summary}`));
            console.log(chalk.blue(`🎯 Environment: ${config.environment}`));
            console.log(chalk.blue(`📁 Output: ${result.filePath}`));
            console.log(chalk.blue(`🤖 Confidence: ${Math.round(result.confidence * 100)}%`));
        }
    }
    catch (error) {
        spinner.fail('Failed to generate test');
        throw error;
    }
}
async function initializeConfig() {
    const spinner = ora('Initializing pwtgen...').start();
    try {
        const envTemplate = `# Jira Configuration
JIRA_BASE_URL=https://your-company.atlassian.net
JIRA_EMAIL=your-email@company.com
JIRA_API_TOKEN=your-api-token

# OpenAI Configuration
OPENAI_API_KEY=your-openai-api-key

# Application URLs
TWO_TEST_BASE_URL=https://dev.your-app.com
QA_BASE_URL=https://qa.your-app.com
SMOKE_BASE_URL=https://staging.your-app.com
PROD_BASE_URL=https://your-app.com

# Test Credentials (use test accounts only)
TEST_USERNAME=test-user
TEST_PASSWORD=test-password
`;
        const fs = await import('fs/promises');
        try {
            await fs.access('.env');
            console.log(chalk.yellow('\n⚠️  .env file already exists'));
        }
        catch {
            await fs.writeFile('.env', envTemplate);
            console.log(chalk.green('\n✅ Created .env template'));
        }
        await fs.mkdir('knowledge-base', { recursive: true });
        await fs.mkdir('knowledge-base/selectors', { recursive: true });
        await fs.mkdir('knowledge-base/workflows', { recursive: true });
        await fs.mkdir('knowledge-base/patterns', { recursive: true });
        spinner.succeed('pwtgen initialized successfully');
        console.log(chalk.blue('\n📝 Next steps:'));
        console.log('1. Update .env file with your credentials');
        console.log('2. Add knowledge base files to knowledge-base/ directory');
        console.log('3. Run: pwtgen embed');
        console.log('4. Run: pwtgen validate');
    }
    catch (error) {
        spinner.fail('Failed to initialize pwtgen');
        throw error;
    }
}
async function validateSetup() {
    const spinner = ora('Validating setup...').start();
    try {
        const requiredEnvVars = [
            'JIRA_BASE_URL',
            'JIRA_EMAIL',
            'JIRA_API_TOKEN',
            'OPENAI_API_KEY'
        ];
        const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
        if (missingVars.length > 0) {
            throw new Error(`Missing environment variables: ${missingVars.join(', ')}`);
        }
        const jiraClient = new JiraClient();
        await jiraClient.testConnection();
        const ragService = new VectraRAGService();
        await ragService.init();
        spinner.succeed('Setup validation completed successfully');
        console.log(chalk.green('\n✅ All systems ready!'));
    }
    catch (error) {
        spinner.fail('Setup validation failed');
        throw error;
    }
}
async function embedKnowledgeBase() {
    const spinner = ora('Embedding knowledge base...').start();
    try {
        const ragService = new VectraRAGService();
        await ragService.ingestKnowledgeBase();
        spinner.succeed('Knowledge base embedded successfully');
    }
    catch (error) {
        spinner.fail('Failed to embed knowledge base');
        throw error;
    }
}
process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception:', error);
    process.exit(1);
});
process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled rejection:', reason);
    process.exit(1);
});
program.parse();
//# sourceMappingURL=cli.js.map