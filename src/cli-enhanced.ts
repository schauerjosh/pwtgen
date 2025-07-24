#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { config } from 'dotenv';
import { MCPService } from './core/MCPService.js';
import { SelfHealingService } from './core/SelfHealingService.js';
import * as fs from 'fs';
import * as path from 'path';
import pkg from '../package.json' with { type: 'json' };
import inquirer from 'inquirer';
import { CodeFormatter } from './utils/CodeFormatter.js';
import { logger } from './utils/logger.js';

// Load environment variables from .env
config();

const program = new Command();

const ENV_URLS: Record<string, string> = {
  test: process.env.TWO_TEST_BASE_URL || '',
  qa: process.env.QA_BASE_URL || '',
  staging: process.env.SMOKE_BASE_URL || '',
  prod: process.env.PROD_BASE_URL || ''
};

program
  .name('pwtgen')
  .description('AI-Powered Playwright Test Generator CLI')
  .version(pkg.version);

program
  .command('generate')
  .alias('gen')
  .description('Generate Playwright test from Jira ticket')
  .option('-t, --ticket <key>', 'Jira ticket key (e.g., PROJ-123)')
  .option('-e, --env <environment>', 'Target environment', 'test')
  .option('-o, --output <path>', 'Output file path')
  .option('--overwrite', 'Overwrite existing test file', false)
  .action(async (options) => {
    const spinner = ora('Building configuration...').start();
    try {
      // Prompt for ticket and environment
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'ticket',
          message: 'Enter Jira ticket key:',
          default: options.ticket,
          validate: (input: string) => /^[A-Z]+-\d+$/.test(input) || 'Invalid Jira ticket key'
        },
        {
          type: 'list',
          name: 'environment',
          message: 'Select target environment:',
          choices: ['test', 'qa', 'staging', 'prod'],
          default: options.env || 'test'
        }
      ]);
      const ticket = answers.ticket;
      const env = answers.environment;
      let playwrightLocation = process.env.PLAYWRIGHT_LOCATION;
      if (!playwrightLocation) {
        console.log(chalk.yellow('[INFO] PLAYWRIGHT_LOCATION is not set in your .env file.'));
        const { setLocation } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'setLocation',
            message: 'Would you like to set PLAYWRIGHT_LOCATION now?',
            default: true
          }
        ]);
        if (setLocation) {
          const { locationPath } = await inquirer.prompt([
            {
              type: 'input',
              name: 'locationPath',
              message: 'Enter the path where Playwright tests should be saved (e.g., playwright/public):',
              validate: (input: string) => input ? true : 'Path required.'
            }
          ]);
          // Update .env file
          let envContent = '';
          try {
            envContent = fs.existsSync('.env') ? fs.readFileSync('.env', 'utf8') : '';
          } catch { /* ignore error */ }
          if (!envContent.includes('PLAYWRIGHT_LOCATION')) {
            envContent += (envContent.endsWith('\n') ? '' : '\n') + `PLAYWRIGHT_LOCATION=${locationPath}\n`;
          } else {
            envContent = envContent.replace(/PLAYWRIGHT_LOCATION=.*/g, `PLAYWRIGHT_LOCATION=${locationPath}`);
          }
          fs.writeFileSync('.env', envContent, 'utf8');
          console.log(chalk.green(`[INFO] .env updated with PLAYWRIGHT_LOCATION=${locationPath}`));
          playwrightLocation = locationPath;
        } else {
          console.log(chalk.red('[ERROR] Please set PLAYWRIGHT_LOCATION in your .env file and rerun the command.'));
          process.exit(1);
        }
      }
      // Prompt for test name only
      const { testName } = await inquirer.prompt([
        {
          type: 'input',
          name: 'testName',
          message: `Enter Playwright test name (will be saved to ${playwrightLocation}/<name>.test.ts):`,
          validate: (input: string) => input ? true : 'Test name required.'
        }
      ]);
      const output = `${playwrightLocation}/${testName}.test.ts`;
      const overwrite = options.overwrite;
      if (fs.existsSync(output) && !overwrite) {
        spinner.fail(`File ${output} already exists. Use --overwrite to replace it.`);
        process.exit(1);
      }
      spinner.succeed('Configuration built successfully');
      const mcp = new MCPService();
      // Interactive dev intervention handler
      const onIntervention = async (step: { stepIndex: number; description: string; suggestedCode: string }) => {
        let promptEnvUrl = '';
        if (step.stepIndex === 0 && ENV_URLS[env]) {
          promptEnvUrl = ENV_URLS[env];
        }
        logInfo(chalk.yellow(`\n🔄 Step ${step.stepIndex + 1}: ${step.description}`));
        if (promptEnvUrl) {
          logInfo(chalk.magenta(`🌐 Environment URL: ${promptEnvUrl}`));
        }
        logInfo(chalk.cyan(`💡 Suggested code:\n${step.suggestedCode}`));
        const { action } = await inquirer.prompt([
          {
            type: 'list',
            name: 'action',
            message: 'Choose an action:',
            choices: [
              { name: 'Accept suggested code', value: 'accept' },
              { name: 'Edit code', value: 'edit' },
              { name: 'Skip this step', value: 'skip' },
              { name: 'Pause for manual debug', value: 'debug' }
            ]
          }
        ]);
        if (action === 'accept') {
          return step.suggestedCode;
        } else if (action === 'edit') {
          const { customCode } = await inquirer.prompt([
            {
              type: 'input',
              name: 'customCode',
              message: 'Type your custom code for this step:'
            }
          ]);
          return customCode;
        } else if (action === 'skip') {
          return '// Step skipped by developer';
        } else if (action === 'debug') {
          logInfo(chalk.magenta('🐛 Debug mode - test generation paused. Do your manual investigation now.'));
          await inquirer.prompt([{ type: 'input', name: 'continue', message: 'Press ENTER to continue...' }]);
          return step.suggestedCode;
        }
        return step.suggestedCode;
      };
      const genSpinner = ora('Generating Playwright test...').start();
      const result = await mcp.generateTestFromTicket(
        { ticket, env, outputPath: output },
        onIntervention
      );
      genSpinner.succeed('Test generated!');
      // Ensure output directory exists
      const outputDir = path.dirname(output);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      const formatter = new CodeFormatter();
      let formattedCode = await formatter.format(result.code);

      // Lint validation: check for missing/extra brackets (simple check)
      const openBrackets = (formattedCode.match(/\{/g) || []).length;
      const closeBrackets = (formattedCode.match(/\}/g) || []).length;
      if (openBrackets !== closeBrackets) {
        logger.warn(`Bracket mismatch detected: {=${openBrackets}, }=${closeBrackets}. Please review the generated code.`);
      }

      // Format with tab spacing of 4
      formattedCode = formattedCode.replace(/^( +)/gm, (m) => '\t'.repeat(Math.ceil(m.length / 4)));

      fs.writeFileSync(output, formattedCode, 'utf-8');
      logInfo(chalk.green(`\n✅ Test generated: ${output}`));
      logInfo(chalk.blue(`📋 Ticket: ${ticket}`));
      logInfo(chalk.blue(`🎯 Environment: ${env} (${ENV_URLS[env]})`));
      logInfo(chalk.blue(`📁 Output: ${output}`));
      logInfo(chalk.blue(`🧪 Test name: ${result.testName}`));
      logInfo(chalk.blue(`📊 Steps: ${result.steps.length}`));
      result.steps.forEach((step, i) => {
        logInfo(chalk.gray(`   ${i + 1}. ${step}`));
      });
    } catch (error) {
      spinner.fail('Failed to generate test');
      console.error(error);
      process.exit(1);
    }
  });

program
  .command('self-heal')
  .description('Run self-healing on an existing test file')
  .option('-f, --file <path>', 'Test file to heal')
  .action(async (options) => {
    if (!options.file) {
      console.error(chalk.red('Missing --file argument'));
      process.exit(1);
    }
    const sh = new SelfHealingService();
    const result = await sh.healTestFile(options.file);
    logInfo(chalk.green('🔧 Self-healing result:') + ' ' + JSON.stringify(result));
  });

program
  .option('--debug', 'Enable debug/info logging', false);

// Prompt for debug mode if not provided
if (!process.argv.includes('--debug')) {
  const { enableDebug } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'enableDebug',
      message: 'Enable debug/info logging?',
      default: false
    }
  ]);
  if (enableDebug) {
    process.argv.push('--debug');
  }
}

program.parseAsync(process.argv);

const debugMode = false;
function logInfo(message: string) {
  if (debugMode) {
    console.log(chalk.blue('[INFO]'), message);
  }
}