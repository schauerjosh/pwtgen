#!/usr/bin/env node
// Suppress Node.js deprecation warnings
process.removeAllListeners('warning');
process.on('warning', (e) => {
  if (e.name === 'DeprecationWarning') return;
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
import type { TestConfig, Environment, RAGContext, GeneratedTest } from './types/index.js';
import pkg from '../package.json' with { type: 'json' };
import path from 'path';
import * as fs from 'fs';
const fsp = fs.promises;
import { execSync, exec } from 'child_process';

dotenvConfig();

const program = new Command();

program
  .name('pwtgen')
  .description('AI-Powered Playwright Test Generator CLI')
  .version(pkg.version);

let debugMode = false;
function logInfo(message: string) {
  if (debugMode) {
    console.log(chalk.blue('[INFO]'), message);
  }
}

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
  .option('--debug', 'Enable debug/info logging', false)
  .action(async (options) => {
    // Only prompt for debug mode if running in a TTY and not with --version or --help
    const isInteractive = process.stdout.isTTY && !process.argv.includes('--version') && !process.argv.includes('--help');
    if (isInteractive && !options.debug && !process.argv.includes('--debug')) {
      const { enableDebug } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'enableDebug',
          message: 'Enable debug/info logging?',
          default: false
        }
      ]);
      if (enableDebug) {
        options.debug = true;
        debugMode = true;
      }
    } else if (options.debug) {
      debugMode = true;
    }
    // Prompt for missing values ONLY here
    if (!options.ticket) {
      const { ticket } = await inquirer.prompt([
        {
          type: 'input',
          name: 'ticket',
          message: 'Enter Jira ticket key:',
          validate: (input: string) => /^[A-Z]+-\d+$/.test(input) ? true : 'Please enter a valid Jira ticket key (e.g., PROJ-123)'
        }
      ]);
      options.ticket = ticket;
    }
    if (!options.env) {
      const { env } = await inquirer.prompt([
        {
          type: 'list',
          name: 'env',
          message: 'Select target environment:',
          choices: ['test', 'qa', 'staging', 'prod'],
          default: 'test'
        }
      ]);
      options.env = env;
    }
    if (!options.output) {
      const { output } = await inquirer.prompt([
        {
          type: 'input',
          name: 'output',
          message: 'Enter output file path:',
          default: getValidTestFilePath(options.ticket ? options.ticket.toLowerCase() : 'playwright-test'),
          validate: (input: string) => {
            const validPath = getValidTestFilePath(input);
            if (validPath.endsWith('.test.ts')) return true;
            return 'Test file path must end with .test.ts';
          }
        }
      ]);
      options.output = getValidTestFilePath(output);
    }
    try {
      const config = await buildTestConfig(options); // buildTestConfig should NOT prompt for anything
      await generateTest(config, options.interactive);
    } catch (error) {
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
  .option('-e, --env <environment>', 'Target environment')
  .option('-n, --name <testName>', 'Test name')
  .option('-o, --output <path>', 'Test file path')
  .option('--debug', 'Enable debug/info logging', false)
  .action(async (options: RecordOptions) => {
    // Only prompt for debug mode if running in a TTY and not with --version or --help
    const isInteractive = process.stdout.isTTY && !process.argv.includes('--version') && !process.argv.includes('--help');
    if (isInteractive && !options.debug && !process.argv.includes('--debug')) {
      const { enableDebug } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'enableDebug',
          message: 'Enable debug/info logging?',
          default: false
        }
      ]);
      if (enableDebug) {
        options.debug = true;
        debugMode = true;
      }
    } else if (options.debug) {
      debugMode = true;
    }
    // Prompt for missing values ONLY here
    let env = options.env;
    if (!env) {
      const response = await inquirer.prompt([
        {
          type: 'list',
          name: 'env',
          message: 'Select the environment:',
          choices: [
            { name: `prod (${process.env.PROD_BASE_URL})`, value: 'prod' },
            { name: `test (${process.env.TWO_TEST_BASE_URL})`, value: 'test' },
            { name: `qa (${process.env.QA_BASE_URL})`, value: 'qa' },
            { name: `staging (${process.env.SMOKE_BASE_URL})`, value: 'staging' }
          ],
          default: 'test',
        },
      ]);
      env = response.env;
      options.env = env;
    }
    let testName = options.testName || options.name;
    if (!testName) {
      const response = await inquirer.prompt([
        {
          type: 'input',
          name: 'testName',
          message: 'Enter Playwright test name:',
          validate: (input: string) => input ? true : 'Test name required.'
        }
      ]);
      testName = response.testName;
      options.testName = testName;
    }
    let output = options.output;
    if (!output) {
      const response = await inquirer.prompt([
        {
          type: 'input',
          name: 'output',
          message: `Enter test file path (default: playwright/public/${testName}.test.ts):`,
          default: `playwright/public/${testName}.test.ts`,
          validate: (input: string) => input ? true : 'Test file path required.'
        }
      ]);
      output = response.output;
      options.output = output;
    }
    await handleRecordCommand({ ...options, env, testName, output });
  });

program
  .command('interactive')
  .description('Streamlined interactive mode: prompts for Jira card and environment, then runs in --interactive mode')
  .action(async () => {
    const inquirer = (await import('inquirer')).default;
    const options: Partial<GenerateOptions> = {};
    if (!process.argv.includes('--ticket')) {
      const { ticket } = await inquirer.prompt([
        {
          type: 'input',
          name: 'ticket',
          message: 'Enter the Jira ticket key (e.g., QA-247):',
          validate: (input: string) => input.trim() ? true : 'Ticket key is required.'
        }
      ]);
      options.ticket = ticket;
    }
    if (!process.argv.includes('--env')) {
      const { env } = await inquirer.prompt([
        {
          type: 'list',
          name: 'env',
          message: 'Select [debug] the environment:',
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

async function handleRecordCommand(options: RecordOptions = {}) {
  // NO PROMPTS HERE, just use options
  logInfo('INSTRUCTIONS:');
  logInfo('1. You will select the environment and specify the file location for your Playwright test.');
  logInfo('2. A browser window will open to the selected environment URL.');
  logInfo('3. Perform your test actions in the browser.');
  logInfo('4. When you are done, CLOSE the browser window.');
  logInfo('5. Your actions will be automatically captured and saved as a Playwright test in the file you specify.');
  logInfo('6. To run your new test, use: npx playwright test <path-to-your-test-file>');
  logInfo('');

  // Check Playwright install
  try {
    execSync('npx playwright --version', { stdio: 'ignore' });
  } catch {
    console.error(chalk.red('Playwright is not installed. Run "npx playwright install" and try again.'));
    process.exit(1);
  }

  // Ensure browsers are installed
  try {
    execSync('npx playwright install', { stdio: 'ignore' });
  } catch {
    console.error(chalk.red('Failed to install Playwright browsers. Please check your environment.'));
    process.exit(1);
  }

  const envKey = String(options.env);
  const url = getBaseUrl(envKey);
  let absPath = options.output;

  // Ensure absPath is a file, not a directory, and is defined
  if (typeof absPath === 'undefined' || !absPath) {
    throw new Error('Output path is required.');
  }
  if (!path.extname(absPath) || (fs.existsSync(absPath) && fs.lstatSync(absPath).isDirectory())) {
    absPath = path.join(absPath, 'recorded.test.ts');
  }

  // User guidance
  console.log(chalk.yellow('\n[IMPORTANT] Do NOT close the Playwright codegen browser window until you are finished recording and the CLI prompts you that recording is complete.'));

  // Retry logic
  let codegenSuccess = false;
  let attempts = 0;
  while (!codegenSuccess && attempts < 2) {
    try {
      logInfo(`\nLaunching Playwright in record mode for: ${url}\n`);
      const { execSync } = await import('child_process');
      execSync(`npx playwright codegen ${url} --output ${absPath}`, { stdio: 'inherit' });
      logInfo(`\n✅ Test actions recorded and saved to ${absPath}`);
      codegenSuccess = true;
    } catch {
      attempts++;
      console.error(chalk.red('\nError: Playwright codegen failed.'));
      if (attempts < 2) {
        const inquirer = (await import('inquirer')).default;
        const { retry } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'retry',
            message: 'Would you like to retry recording? (Make sure you do not close the browser window prematurely)',
            default: true,
          },
        ]);
        if (!retry) break;
      } else {
        console.error(chalk.red('Codegen failed twice. Please check your environment, output path, and Playwright installation.'));
      }
    }
  }

  // After codegen, but before writing output, check if file exists and prompt for action
  let mergeMode = false;
  if (fs.existsSync(absPath)) {
    const { fileAction } = await inquirer.prompt([
      {
        type: 'list',
        name: 'fileAction',
        message: `Test file ${absPath} already exists. What would you like to do?`,
        choices: [
          { name: 'Overwrite', value: 'overwrite' },
          { name: 'Merge (append new steps to existing test)', value: 'merge' },
          { name: 'Cancel', value: 'cancel' }
        ],
        default: 'merge',
      },
    ]);
    if (fileAction === 'cancel') {
      console.log(chalk.yellow('Operation cancelled. No changes made.'));
      return;
    }
    if (fileAction === 'merge') {
      mergeMode = true;
    }
  }

  // Read new test code from codegen
  let newTestCode = '';
  try {
    newTestCode = await fsp.readFile(absPath, 'utf8');
  } catch (e) {
    console.error(chalk.red('Failed to read newly recorded test file:'), e);
    return;
  }

  if (mergeMode) {
    // Merge: read existing file, append new steps inside test block
    let existing = '';
    try {
      existing = await fsp.readFile(absPath, 'utf8');
    } catch (e) {
      console.error(chalk.red('Failed to read existing test file for merge:'), e);
      return;
    }
    // Simple merge: try to find the last closing bracket of the test block and insert before it
    const testBlockMatch = existing.match(/(test\.(?:describe|it|test)\([^]*?\{)([^]*)(\}\);?)/);
    if (testBlockMatch) {
      // Compute newSteps before using it
      const newSteps = newTestCode.replace(/^[\s\S]*?\{/, '').replace(/\}\);?\s*$/, '');
      const start = testBlockMatch[1];
      const body = testBlockMatch[2];
      const end = testBlockMatch[3];
      const merged = `${start}${body}\n// --- MERGED STEPS ---\n${newSteps}\n${end}`;
      await fsp.writeFile(absPath, merged, 'utf8');
      console.log(chalk.green('Merged new steps into existing test file: ' + absPath));
    } else {
      // Fallback: just append
      await fsp.appendFile(absPath, '\n// --- MERGED STEPS ---\n' + newTestCode);
      console.log(chalk.yellow('Could not find test block, appended new steps to end of file.'));
    }
  } else {
    // Overwrite mode: file is replaced
    // Already written by codegen, so nothing to do
    console.log(chalk.green('Test file written: ' + absPath));
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
      logInfo(`\nRunning: TEST_ENV=${envKey} PWDEBUG=1 npx playwright test ${absPath}\n`);
      const { execSync } = await import('child_process');
      execSync(`TEST_ENV=${envKey} PWDEBUG=1 npx playwright test ${absPath}`, { stdio: 'inherit' });
    } catch (err) {
      console.error('Error:', err);
    }
  }
  return;
}

interface GenerateOptions {
  ticket?: string;
  env?: string;
  output?: string;
  overwrite?: boolean;
  dryRun?: boolean;
  noPageObjects?: boolean;
  interactive?: boolean;
  debug?: boolean;
}

interface RecordOptions extends GenerateOptions {
  name?: string;
  testName?: string;
  playwrightLocation?: string;
}

// Utility to extract first valid user from test-users.md
async function buildTestConfig(options: GenerateOptions): Promise<TestConfig> {
  try {
    // NO PROMPTS HERE, just use options
    const spinner = ora('Building configuration...').start();
    const jiraClient = new JiraClient();
    const ticket = await jiraClient.getTicket(options.ticket as string);
    const config: TestConfig = {
      ticket,
      environment: options.env as Environment,
      outputPath: options.output as string,
      overwrite: options.overwrite,
      dryRun: options.dryRun,
      pageObjectPattern: options.noPageObjects !== true
    };
    spinner.succeed('Configuration built successfully');
    return validateConfig(config);
  } catch (error) {
    const spinner = ora('Building configuration...').start();
    spinner.fail('Failed to build configuration');
    throw error;
  }
}

async function generateTest(config: TestConfig, interactive = false): Promise<void> {
  console.log(chalk.green('[pwtgen] Starting test generation...'));
  const spinner = ora('Generating Playwright test...').start();
  try {
    const generator = new TestGenerator();
    const interventionIndex = null;
    const interventionCode = '';
    if (interactive) {
      // Dev intervention loop
      const ragContexts = await generator['retrieveContext'](config);
      let aiSteps = await generator['generateTestCode'](config, ragContexts);
      // Split on test.step boundaries, but keep the import and describe block at the top
      const stepStart = aiSteps.indexOf('test.describe');
      if (stepStart > 0) {
        aiSteps = aiSteps.slice(stepStart);
      }
      // Split AI-generated steps for intervention
      const steps = aiSteps.split(/(?=await test\.step)/g);
      for (let i = 0; i < steps.length; i++) {
        console.log(chalk.yellow(`\nStep ${i + 1}:`));
        console.log(chalk.cyan(steps[i]));
        spinner.stop();
        const interventionChoices = [
          { name: 'Accept suggested code', value: 'accept' },
          { name: 'Edit code (manual/codegen)', value: 'edit' },
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
              // Cross-platform browser open
              const platform = process.platform;
              let openCmd = '';
              if (platform === 'darwin') {
                openCmd = `open "${jiraUrl}"`;
              } else if (platform === 'win32') {
                openCmd = `start "" "${jiraUrl}"`;
              } else {
                openCmd = `xdg-open "${jiraUrl}"`;
              }
              exec(openCmd, (error: Error | null) => {
                if (error) {
                  console.warn('Could not open Jira card in browser:', error);
                }
              });
            } catch (err) {
              console.warn('Could not open Jira card in browser:', err);
            }
          }
          // Launch Playwright codegen with current test file
          const url = getBaseUrl(config.environment);
          const testFilePath = config.outputPath;
          // Determine auth.json path (same as .env)
          const envPath = path.resolve(process.cwd(), '.env');
          const authPath = path.join(path.dirname(envPath), 'auth.json');
          let storageStateArg = '';
          if (fs.existsSync(authPath)) {
            storageStateArg = `--storage-state=${authPath}`;
            logInfo(`Using authentication state from: ${authPath}`);
          }
          try {
            logInfo(`\nLaunching Playwright codegen for: ${url} with file: ${testFilePath}\n`);
            execSync(`npx playwright codegen ${url} --output ${testFilePath} ${storageStateArg}`.trim(), { stdio: 'inherit' });
            logInfo(`\n✅ Edited actions recorded and saved to ${testFilePath}`);
            // After codegen, read the file and extract only the relevant step code
            const updatedCode = fs.readFileSync(testFilePath, 'utf8');
            const match = updatedCode.match(/await test\.step\([\s\S]*?\}\);/);
            if (match) {
              steps[i] = match[0] + ' // ✏️ Developer modified via codegen';
            } else {
              steps[i] = updatedCode + ' // ✏️ Developer modified via codegen';
            }
          } catch {
            console.error('Error recording edited actions');
          }
        } else if (action === 'skip') {
          steps[i] = '// Step skipped by developer';
        }
        spinner.start();
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
        const url = getBaseUrl(config.environment);
        const { execSync } = await import('child_process');
        try {
          logInfo(`\nLaunching Playwright codegen for: ${url}\n`);
          execSync(`npx playwright codegen ${url} --output ${codegenPath}`, { stdio: 'inherit' });
          logInfo(`\n✅ Manual actions recorded and saved to ${codegenPath}`);
          // Read manual steps
          await fsp.readFile(codegenPath, 'utf8');
        } catch (err) {
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
          } else {
            console.log('Skipping manual codegen step.');
          }
        }
      }
      // Merge header and steps for final output
      const mergedCode = steps.join('\n\n');
      // Use fsPromises for all async file operations
      const fsPromises = await import('fs/promises');
      await fsPromises.mkdir(config.outputPath.replace(/\/[^/]+$/, ''), { recursive: true });
      await fsPromises.writeFile(config.outputPath, mergedCode, 'utf8');
      spinner.succeed('Test generation complete');
      console.log(chalk.green('Test saved to: ' + config.outputPath));
      if (interventionIndex !== null) {
        const mappingFile = 'knowledge-base/workflows/card-test-mapping.md';
        const mappingDir = 'knowledge-base/workflows';
        await fsPromises.mkdir(mappingDir, { recursive: true });
        const cardKey = config.ticket?.key || '';
        const cardSummary = config.ticket?.summary || '';
        const cardDetails = config.ticket?.description || '';
        const mappingText = '\n---\nCard: ' + cardKey + '\nSummary: ' + cardSummary + '\nDetails: ' + cardDetails + '\nTest File: ' + config.outputPath + '\nIntervention Step: ' + (interventionIndex + 1) + '\nIntervention Code: ' + interventionCode.substring(0, 200) + '\n---\n';
        await fsPromises.appendFile(mappingFile, mappingText);
        console.log(chalk.green('Intervention mapping appended to ' + mappingFile));
      }
      return;
    }
    // Non-interactive: generate steps directly
    // Remove unused steps variable (already handled by generator.generate)
    // const steps = aiSteps.split(/(?=await test\.step)/g);
    // Get the base URL for the selected environment
    // Remove unused baseUrl, email, password variables

    // Remove loginSteps variable and any code that references it
    // Instead, just call generator.generate(config) and use the returned code
    const result = await generator.generate(config);
    const mergedCode = result.content;
    // Write final merged code to output path
    try {
      const stats = await fsp.stat(config.outputPath).catch(() => undefined);
      if (stats && stats.isDirectory()) {
        const backupPath = config.outputPath + '.bak_' + Date.now();
        await fsp.rename(config.outputPath, backupPath);
        logInfo(`Directory at ${config.outputPath} was renamed to ${backupPath} to allow file creation.`);
      }
    } catch (e) {
      if (typeof e === 'object' && e !== null && 'code' in e && (e as { code?: string }).code !== 'ENOENT') throw e;
      // ENOENT is fine (file doesn't exist yet)
    }
    // Before writing, ensure output path is a file, not a directory
    try {
      const stats = await fsp.stat(config.outputPath).catch(() => undefined);
      if (stats && stats.isDirectory()) {
        throw new Error(`Output path ${config.outputPath} is a directory. Please provide a valid file path ending with .spec.ts.`);
      }
    } catch (e) {
      // ENOENT is fine (file doesn't exist yet)
      if (e && typeof e === 'object' && 'code' in e && (e as { code?: string }).code !== 'ENOENT') throw e;
    }
    await fsp.mkdir(config.outputPath.replace(/\/[^/]+$/, ''), { recursive: true });
    await fsp.writeFile(config.outputPath, mergedCode, 'utf8');
    spinner.succeed('Test generation complete');
    console.log(chalk.green('Test saved to: ' + config.outputPath));
    if (interventionIndex !== null) {
      const mappingFile = 'knowledge-base/workflows/card-test-mapping.md';
      const mappingDir = 'knowledge-base/workflows';
      await fsp.mkdir(mappingDir, { recursive: true });
      const cardKey = config.ticket?.key || '';
      const cardSummary = config.ticket?.summary || '';
      const cardDetails = config.ticket?.description || '';
      const mappingText = '\n---\nCard: ' + cardKey + '\nSummary: ' + cardSummary + '\nDetails: ' + cardDetails + '\nTest File: ' + config.outputPath + '\nIntervention Step: ' + (interventionIndex + 1) + '\nIntervention Code: ' + interventionCode.substring(0, 200) + '\n---\n';
      await fsp.appendFile(mappingFile, mappingText);
      console.log(chalk.green('Intervention mapping appended to ' + mappingFile));
    }
    logTestSummary(result, config);
  } catch (error) {
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

program
  .command('self-heal')
  .description('Run self-healing on an existing test file')
  .option('-f, --file <path>', 'Test file to heal')
  .action(async (options) => {
    if (!options.file) {
      console.error(chalk.red('Missing --file argument'));
      process.exit(1);
    }
    const { SelfHealingService } = await import('./core/SelfHealingService.js');
    const sh = new SelfHealingService();
    const result = await sh.healTestFile(options.file);
    logInfo(chalk.green('🔧 Self-healing result:') + ' ' + JSON.stringify(result));
  });

// Improved output for test generation
function logTestSummary(result: GeneratedTest & { content: string, ragContexts?: RAGContext[], confidence?: number, testName?: string }, config: TestConfig) {
  console.log(chalk.green(`\n✅ Test generated: ${config.outputPath}`));
  console.log(chalk.blue(`📋 Ticket: ${config.ticket.key} - ${config.ticket.summary}`));
  console.log(chalk.blue(`🎯 Environment: ${config.environment}`));
  console.log(chalk.blue(`📁 Output: ${config.outputPath}`));
  console.log(chalk.blue(`🧪 Test name: ${result.testName}`));
  if (result.ragContexts) {
    console.log(chalk.blue(`📊 Contexts: ${result.ragContexts.length}`));
  }
  if (result.confidence !== undefined) {
    console.log(chalk.blue(`🧠 Confidence: ${Math.round(result.confidence * 100)}%`));
  }
}

function getValidTestFilePath(input: string): string {
  let name = input.trim();
  // Remove any trailing slashes or directory indicators
  name = name.replace(/\/+$/, '');
  // Ensure .test.ts extension
  if (!name.endsWith('.test.ts')) {
    name += '.test.ts';
  }
  // Default to playwright/public if no path provided
  if (!name.includes('/')) {
    name = `playwright/public/${name}`;
  }
  return name;
}

// Replace TestGenerator.getBaseUrl with a local helper
function getBaseUrl(env: string): string {
  const ENV_URLS: Record<string, string> = {
    prod: process.env.PROD_BASE_URL || '',
    test: process.env.TWO_TEST_BASE_URL || '',
    qa: process.env.QA_BASE_URL || '',
    staging: process.env.SMOKE_BASE_URL || ''
  };
  return ENV_URLS[env] || '';
}

program.parse(process.argv);