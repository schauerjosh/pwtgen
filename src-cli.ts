#!/usr/bin/env node
// src/cli.ts
import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { config } from 'dotenv';
import { TestGenerator } from './core/TestGenerator.js';
import { JiraClient } from './jira/JiraClient.js';
import { ChromaRAGService } from './rag/ChromaRAGService.js';
import { validateConfig } from './utils/validation.js';
import { logger } from './utils/logger.js';
import type { TestConfig, Environment } from './types/index.js';

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
  .option('-e, --env <environment>', 'Target environment', 'dev')
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

program
  .command('embed')
  .description('Embed knowledge base into vector store')
  .action(async () => {
    await embedKnowledgeBase();
  });

async function buildTestConfig(options: any): Promise<TestConfig> {
  const spinner = ora('Building configuration...').start();

  try {
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
        choices: ['dev', 'qa', 'staging', 'prod'],
        default: 'dev',
        when: !options.env
      },
      {
        type: 'input',
        name: 'outputPath',
        message: 'Enter output file path:',
        default: (answers: any) => `tests/e2e/${(options.ticket || answers.ticket).toLowerCase()}.spec.ts`,
        when: !options.output
      }
    ]);

    const jiraClient = new JiraClient();
    const ticket = await jiraClient.getTicket(options.ticket || answers.ticket);

    const config: TestConfig = {
      ticket,
      environment: (options.env || answers.environment) as Environment,
      outputPath: options.output || answers.outputPath,
      overwrite: options.overwrite,
      dryRun: options.dryRun,
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

async function initializeConfig(): Promise<void> {
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
    } catch {
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
  } catch (error) {
    spinner.fail('Failed to initialize pwtgen');
    throw error;
  }
}

async function validateSetup(): Promise<void> {
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

    const ragService = new ChromaRAGService();
    await ragService.init();

    spinner.succeed('Setup validation completed successfully');
    console.log(chalk.green('\n✅ All systems ready!'));
  } catch (error) {
    spinner.fail('Setup validation failed');
    throw error;
  }
}

async function embedKnowledgeBase(): Promise<void> {
  const spinner = ora('Embedding knowledge base...').start();

  try {
    const ragService = new ChromaRAGService();
    await ragService.ingestKnowledgeBase();
    spinner.succeed('Knowledge base embedded successfully');
  } catch (error) {
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
