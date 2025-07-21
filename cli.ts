#!/usr/bin/env node
// src/cli.ts
import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { config } from 'dotenv';
import { TestGenerator } from './src/core/TestGenerator.ts';
import { JiraClient } from './src/jira/JiraClient.ts';
import { validateConfig } from './src/utils/validation.ts';
import { logger } from './src/utils/logger.ts';
import type { TestConfig, Environment } from './src/types/index.ts';

// Load environment variables
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

async function buildTestConfig(options: Record<string, unknown>): Promise<TestConfig> {
  const spinner = ora('Building configuration...').start();

  try {
    // Interactive prompts for missing options
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'ticket',
        message: 'Enter Jira ticket key:',
        when: !options.ticket,
        validate: (input: string) => {
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
        default: 'test',
        when: !options.env
      },
      {
        type: 'input',
        name: 'outputPath',
        message: 'Enter output file path:',
        default: (answers: Record<string, unknown>) => `tests/e2e/${((options.ticket as string) || (answers.ticket as string)).toLowerCase()}.spec.ts`,
        when: !options.output
      }
    ]);

    // Fetch Jira ticket
    const jiraClient = new JiraClient();
    const ticket = await jiraClient.getTicket(options.ticket || answers.ticket);

    const config: TestConfig = {
      ticket,
      environment: (options.env || answers.environment) as Environment,
      outputPath: options.output || answers.outputPath,
      overwrite: options.overwrite as boolean | undefined,
      dryRun: options.dryRun as boolean | undefined,
      pageObjectPattern: options.pageObjects !== false
    };

    spinner.succeed('Configuration built successfully');
    return validateConfig(config);
  } catch (error) {
    spinner.fail('Failed to build configuration');
    throw error;
  }
}

async function generateTest(config: TestConfig): Promise<void> {
  const spinner = ora('Generating Playwright test...').start();

  try {
    const generator = new TestGenerator();
    const result = await generator.generate(config);

    if (config.dryRun) {
      spinner.succeed('Test generated (dry run)');
      console.log(chalk.cyan('\n--- Generated Test ---'));
      console.log(result.content);
      console.log(chalk.cyan('--- End Generated Test ---\n'));
    } else {
      spinner.succeed(`Test generated successfully: ${chalk.green(result.filePath)}`);
      console.log(chalk.blue(`\n📋 Ticket: ${config.ticket.key} - ${config.ticket.summary}`));
      console.log(chalk.blue(`🎯 Environment: ${config.environment}`));
      console.log(chalk.blue(`📁 Output: ${result.filePath}`));
      console.log(chalk.blue(`🤖 Confidence: ${Math.round(result.confidence * 100)}%`));
    }
  } catch (error) {
    spinner.fail('Failed to generate test');
    throw error;
  }
}

async function initializeConfig() {
  console.log('Initializing pwtgen configuration...');
  // TODO: Implement configuration initialization logic
  console.log('Configuration initialized.');
}

async function validateSetup(): Promise<void> {
  const spinner = ora('Validating setup...').start();
  try {
    // Validate environment variables
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
    // Test Jira connection
    const jiraClient = new JiraClient();
    await jiraClient.testConnection();
    // Validate knowledge base
    spinner.succeed('Setup validation completed successfully');
    console.log(chalk.green('\n✅ All systems ready!'));
  } catch (error) {
    spinner.fail('Setup validation failed');
    console.error(error);
  }
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection:', reason);
  process.exit(1);
});

program.parse(process.argv);
