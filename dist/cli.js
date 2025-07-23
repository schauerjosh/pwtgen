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
import { config as dotenvConfig } from 'dotenv';
import { TestGenerator } from './core/TestGenerator.js';
import { JiraClient } from './jira/JiraClient.js';
import { validateConfig } from './utils/validation.js';
import { logger } from './utils/logger.js';
dotenvConfig();
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
program
    .command('interactive')
    .description('Streamlined interactive mode: prompts for Jira card and environment, then runs in --interactive mode')
    .action(async () => {
    const inquirer = (await import('inquirer')).default;
    const options = {};
    if (!process.argv.includes('--ticket')) {
        const { ticket } = await inquirer.prompt([
            {
                type: 'input',
                name: 'ticket',
                message: 'Enter the Jira ticket key (e.g., QA-247):',
                validate: (input) => input.trim() ? true : 'Ticket key is required.'
            }
        ]);
        options.ticket = ticket;
    }
    if (!process.argv.includes('--env')) {
        const { env } = await inquirer.prompt([
            {
                type: 'list',
                name: 'env',
                message: 'Select the environment:',
                choices: ['test', 'prod', 'qa', 'staging'],
                default: 'test',
            }
        ]);
        options.env = env;
    }
    options.interactive = true;
    const config = await buildTestConfig(options);
    await generateTest(config, true);
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
            catch { /* ignore error */ }
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
            catch { /* ignore error */ }
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
// Utility to extract first valid user from test-users.md
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
async function getDefaultTestUser() {
    const fs = await import('fs/promises');
    // Resolve path relative to project root, regardless of src or dist
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    // Try both possible locations
    let userFile;
    try {
        userFile = join(__dirname, '../knowledge-base/fixtures/test-users.md');
        return await tryParseUserFile(userFile, fs);
    }
    catch { }
    try {
        userFile = join(__dirname, '../../knowledge-base/fixtures/test-users.md');
        return await tryParseUserFile(userFile, fs);
    }
    catch { }
    return { email: 'testuser@example.com', password: 'password' };
}
async function tryParseUserFile(userFile, fs) {
    const file = await fs.readFile(userFile, 'utf8');
    const match = file.match(/export const validUsers = (\[[\s\S]*?\]);/);
    if (match) {
        const validUsers = eval(match[1]);
        return validUsers[0];
    }
    throw new Error('No valid users found');
}
async function buildTestConfig(options) {
    try {
        // Only prompt for missing args
        const questions = [];
        if (!options.ticket) {
            questions.push({
                type: 'input',
                name: 'ticket',
                message: 'Enter Jira ticket key:',
                validate: (input) => {
                    if (!input.match(/^[A-Z]+-\d+$/)) {
                        return 'Please enter a valid Jira ticket key (e.g., PROJ-123)';
                    }
                    return true;
                }
            });
        }
        if (!options.env) {
            questions.push({
                type: 'list',
                name: 'environment',
                message: 'Select target environment:',
                choices: ['test', 'qa', 'staging', 'prod'],
                default: 'test'
            });
        }
        questions.push({
            type: 'input',
            name: 'outputPath',
            message: 'Enter output file path:',
            default: options.output || ((answers) => `tests/e2e/${(options.ticket || answers.ticket).toLowerCase()}.spec.ts`)
        });
        questions.push({
            type: 'confirm',
            name: 'overwrite',
            message: 'Overwrite existing test file if it exists?',
            default: !!options.overwrite
        });
        const answers = questions.length > 0 ? await inquirer.prompt(questions) : {};
        const spinner = ora('Building configuration...').start();
        const jiraClient = new JiraClient();
        const ticket = await jiraClient.getTicket(options.ticket || answers.ticket);
        // Prompt for vCreative login if card description contains 'as yourself' or 'ghost in as'
        let vCreativeCredentials = undefined;
        if (/as yourself|ghost in as/i.test(ticket.description)) {
            spinner.stop();
            console.log('[DEBUG] Prompting for vCreative credentials...');
            vCreativeCredentials = await inquirer.prompt([
                { type: 'input', name: 'email', message: 'Enter your vCreative login email:' },
                { type: 'password', name: 'password', message: 'Enter your vCreative password:' }
            ]);
            spinner.start();
        }
        const config = {
            ticket,
            environment: (options.env || answers.environment),
            outputPath: answers.outputPath || options.output,
            overwrite: answers.overwrite ?? options.overwrite,
            dryRun: false,
            pageObjectPattern: false,
            vCreativeCredentials
        };
        spinner.succeed('Configuration built successfully');
        return validateConfig(config);
    }
    catch (error) {
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
        let manualSteps = '';
        let steps = [];
        if (interactive) {
            // Dev intervention loop
            const ragContexts = await generator['retrieveContext'](config);
            const aiSteps = await generator['generateTestCode'](config, ragContexts);
            steps = aiSteps.split(/(?=await test\.step)/g);
            for (let i = 0; i < steps.length; i++) {
                console.log(chalk.yellow(`\nStep ${i + 1}:`));
                console.log(chalk.cyan(steps[i]));
                spinner.stop(); // Ensure spinner does not hide prompt
                const interventionChoices = [
                    { name: 'Accept suggested code', value: 'accept' },
                    { name: 'Edit code (manual/codegen)', value: 'edit' },
                    { name: 'Insert page.pause() here (debug/manual codegen)', value: 'pause' },
                    { name: 'Skip this step', value: 'skip' }
                ];
                const { action } = await inquirer.prompt([
                    {
                        type: 'list',
                        name: 'action',
                        message: 'Choose an action:',
                        choices: interventionChoices
                    }
                ]);
                if (action === 'pause') {
                    steps[i] = 'await page.pause(); // ⏸️ Paused for manual intervention via Playwright Inspector';
                    // Write the current test file with the pause inserted
                    const fs = await import('fs/promises');
                    const { TestGeneratorUtils } = await import('./core/TestGenerator.js');
                    const baseUrl = TestGeneratorUtils.getBaseUrl(config.environment);
                    let email, password;
                    if (config.vCreativeCredentials && config.vCreativeCredentials.email && config.vCreativeCredentials.password) {
                        email = config.vCreativeCredentials.email;
                        password = config.vCreativeCredentials.password;
                    }
                    else if (process.env.TEST_EMAIL && process.env.TEST_PASSWORD) {
                        email = process.env.TEST_EMAIL;
                        password = process.env.TEST_PASSWORD;
                    }
                    else {
                        const user = await getDefaultTestUser();
                        email = user.email;
                        password = user.password;
                    }
                    const loginSteps = `\n    await page.goto('${baseUrl}/login');\n    await page.getByRole('textbox', { name: 'Email' }).fill('${email}');\n    await page.getByRole('textbox', { name: 'Password' }).fill('${password}');\n    await page.getByRole('button', { name: /login/i }).click();\n    await expect(page).toHaveURL(/dashboard|home|main/i); // Adjust as needed\n    `;
                    const mergedStepsNow = steps.filter(Boolean).join('\n\n');
                    let mergedCodeNow = 'import { expect, test } from "@playwright/test";\n\n';
                    mergedCodeNow += 'test.describe(\'Calendar View Functionality\', () => {\n';
                    mergedCodeNow += '  test.beforeEach(async ({ page }) => {\n' + loginSteps + '  });\n\n';
                    mergedCodeNow += '  test(\'Verify Calendar View and Functionality\', async ({ page }) => {\n';
                    mergedCodeNow += mergedStepsNow.split('\n').map(line => '    ' + line).join('\n') + '\n';
                    mergedCodeNow += '  });\n\n';
                    mergedCodeNow += '  test.afterEach(async ({ page }, testInfo) => {\n';
                    mergedCodeNow += '    if (testInfo.status !== testInfo.expectedStatus) {\n';
                    mergedCodeNow += '      await page.screenshot({ path: `screenshots/' + '${testInfo.title}' + '.png`, fullPage: true });\n';
                    mergedCodeNow += '    }\n';
                    mergedCodeNow += '  });\n';
                    mergedCodeNow += '});\n';
                    await fs.writeFile(config.outputPath, mergedCodeNow, 'utf8');
                    console.log('\n[INFO] Inserted `await page.pause()` at this step.');
                    console.log('Launching Playwright Inspector...');
                    console.log('When you are done, copy the generated code in the Inspector (Ctrl+C), then close the Inspector.');
                    // Automatically launch Playwright Inspector
                    const { execSync } = await import('child_process');
                    try {
                        execSync(`npx playwright test ${config.outputPath} --debug`, { stdio: 'inherit' });
                    }
                    catch { /* Inspector exited, continue */ }
                    // After Inspector closes, read clipboard and insert code at this step
                    const clipboardy = await import('clipboardy');
                    const clipboardCode = clipboardy.default.readSync();
                    if (clipboardCode && clipboardCode.trim()) {
                        // Insert clipboard code after the pause step
                        steps[i] = 'await page.pause(); // ⏸️ Paused for manual intervention via Playwright Inspector\n' + clipboardCode.trim();
                        console.log('\n[INFO] Inserted code from clipboard into the test at this step.');
                    }
                    else {
                        console.log('\n[WARN] No code found in clipboard. Please copy the code from the Inspector before closing.');
                    }
                    continue;
                }
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
        }
        else {
            // Non-interactive: generate steps directly
            const ragContexts = await generator['retrieveContext'](config);
            const aiSteps = await generator['generateTestCode'](config, ragContexts);
            steps = aiSteps.split(/(?=await test\.step)/g);
        }
        // Merge AI/dev steps and manual steps into a single, robust pipeline
        const filteredSteps = steps.filter(Boolean).map((step) => {
            if (/^import\s+\{\s*expect,?\s*test\s*\}/.test(step))
                return '';
            if (/^test\.describe\(/.test(step))
                return '';
            if (/^test\('/.test(step))
                return '';
            if (/^test\.afterEach\(/.test(step))
                return '';
            if (/^test\.beforeEach\(/.test(step))
                return '';
            return step;
        }).filter(Boolean);
        // Get the base URL for the selected environment
        const { TestGeneratorUtils } = await import('./core/TestGenerator.js');
        const baseUrl = TestGeneratorUtils.getBaseUrl(config.environment);
        // Use credentials from vCreativeCredentials, .env, or test-users.md
        let email, password;
        if (config.vCreativeCredentials && config.vCreativeCredentials.email && config.vCreativeCredentials.password) {
            email = config.vCreativeCredentials.email;
            password = config.vCreativeCredentials.password;
        }
        else if (process.env.TEST_EMAIL && process.env.TEST_PASSWORD) {
            email = process.env.TEST_EMAIL;
            password = process.env.TEST_PASSWORD;
        }
        else {
            const user = await getDefaultTestUser();
            email = user.email;
            password = user.password;
        }
        // Generate login steps
        const loginSteps = `\n    await page.goto('${baseUrl}/login');\n    await page.getByRole('textbox', { name: 'Email' }).fill('${email}');\n    await page.getByRole('textbox', { name: 'Password' }).fill('${password}');\n    await page.getByRole('button', { name: /login/i }).click();\n    await expect(page).toHaveURL(/dashboard|home|main/i); // Adjust as needed\n    `;
        const mergedSteps = filteredSteps.join('\n\n');
        let mergedCode = 'import { expect, test } from "@playwright/test";\n\n';
        mergedCode += 'test.describe(\'Calendar View Functionality\', () => {\n';
        mergedCode += '  test.beforeEach(async ({ page }) => {\n' + loginSteps + '  });\n\n';
        mergedCode += '  test(\'Verify Calendar View and Functionality\', async ({ page }) => {\n';
        mergedCode += mergedSteps.split('\n').map(line => '    ' + line).join('\n') + '\n';
        mergedCode += '  });\n\n';
        mergedCode += '  test.afterEach(async ({ page }, testInfo) => {\n';
        mergedCode += '    if (testInfo.status !== testInfo.expectedStatus) {\n';
        mergedCode += '      await page.screenshot({ path: `screenshots/' + '${testInfo.title}' + '.png`, fullPage: true });\n';
        mergedCode += '    }\n';
        mergedCode += '  });\n';
        mergedCode += '});\n';
        // Remove duplicate Playwright imports
        mergedCode = mergedCode.replace(/(import\s+\{\s*expect,?\s*test\s*\}\s+from\s+'@playwright\/test';?\s*)+/g, 'import { expect, test } from "@playwright/test";\n');
        // When merging manual steps, robustly strip all imports and all Playwright block statements (test, test.describe, test.beforeEach, test.afterEach, etc.) from manual/dev intervention code before merging. Only keep the step/action code. Update merging logic to handle all edge cases and prevent nested blocks.
        if (manualSteps) {
            // Remove all import statements (anywhere in the code, not just at the start of lines)
            let cleaned = manualSteps.replace(/import\s+\{?[^\n;]*\}?\s+from\s+['"][^'"]+['"];?/g, '').replace(/^import[^\n]*\n?/gm, '').trim();
            // Remove all test.describe, test.beforeEach, test.afterEach, and similar Playwright block statements (including their bodies)
            const blockPatterns = [
                /test\s*\.\s*describe\s*\([^)]*\)\s*{[\s\S]*?^\s*}\s*$/gm,
                /test\s*\.\s*beforeEach\s*\([^)]*\)\s*{[\s\S]*?^\s*}\s*$/gm,
                /test\s*\.\s*afterEach\s*\([^)]*\)\s*{[\s\S]*?^\s*}\s*$/gm,
                /test\s*\([^)]*\)\s*{[\s\S]*?^\s*}\s*$/gm
            ];
            for (const pattern of blockPatterns) {
                cleaned = cleaned.replace(pattern, '');
            }
            // Remove any remaining describe(...) blocks (non-Playwright)
            cleaned = cleaned.replace(/describe\s*\([^)]*\)\s*{[\s\S]*?^\s*}\s*$/gm, '');
            // Remove any remaining beforeEach/afterEach blocks (non-Playwright)
            cleaned = cleaned.replace(/beforeEach\s*\([^)]*\)\s*{[\s\S]*?^\s*}\s*$/gm, '');
            cleaned = cleaned.replace(/afterEach\s*\([^)]*\)\s*{[\s\S]*?^\s*}\s*$/gm, '');
            // Remove any leftover empty lines
            cleaned = cleaned.replace(/^[ \t]*\n/gm, '');
            cleaned = cleaned.trim();
            // If nothing left, fallback to original manualSteps
            if (!cleaned)
                cleaned = manualSteps;
            // Indent and annotate
            if (!mergedCode.includes(cleaned.substring(0, 40))) {
                mergedCode += '\n\n// Manual steps recorded (dev intervention):\n' + cleaned.split('\n').map(line => '    ' + line).join('\n');
            }
        }
        // Write final merged code to output path
        const fs = await import('fs/promises');
        await fs.mkdir(config.outputPath.replace(/\/[^/]+$/, ''), { recursive: true });
        await fs.writeFile(config.outputPath, mergedCode, 'utf8');
        spinner.succeed('Test generation complete');
        console.log(chalk.green('Test saved to: ' + config.outputPath));
        if (interventionIndex !== null) {
            const mappingFile = 'knowledge-base/workflows/card-test-mapping.md';
            const mappingDir = 'knowledge-base/workflows';
            await fs.mkdir(mappingDir, { recursive: true });
            const cardKey = config.ticket?.key || '';
            const cardSummary = config.ticket?.summary || '';
            const cardDetails = config.ticket?.description || '';
            const mappingText = '\n---\nCard: ' + cardKey + '\nSummary: ' + cardSummary + '\nDetails: ' + cardDetails + '\nTest File: ' + config.outputPath + '\nIntervention Step: ' + (interventionIndex + 1) + '\nIntervention Code: ' + interventionCode.substring(0, 200) + '\n---\n';
            await fs.appendFile(mappingFile, mappingText);
            console.log(chalk.green('Intervention mapping appended to ' + mappingFile));
        }
    }
    catch (error) {
        spinner.fail('Failed to generate test');
        logger.error(error);
        throw error;
    }
}
async function initializeConfig() {
    console.log('Initializing pwtgen configuration...');
    // ...existing init logic...
}
async function validateSetup() {
    console.log('Validating setup...');
    // ...existing validation logic...
}
async function embedKnowledgeBase() {
    console.log('Embedding knowledge base...');
    // ...existing embedding logic...
}
program.parse(process.argv);
//# sourceMappingURL=cli.js.map