#!/usr/bin/env node
import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { config } from 'dotenv';
import { MCPService } from './core/MCPService.js';
import { SelfHealingService } from './core/SelfHealingService.js';
import * as fs from 'fs';
import * as path from 'path';
// Load environment variables from .env
config();
const program = new Command();
const ENV_URLS = {
    test: process.env.TWO_TEST_BASE_URL || '',
    qa: process.env.QA_BASE_URL || '',
    staging: process.env.SMOKE_BASE_URL || '',
    prod: process.env.PROD_BASE_URL || ''
};
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
    .action(async (options) => {
    const spinner = ora('Building configuration...').start();
    try {
        // Prompt for all args, even if provided
        const answers = await inquirer.prompt([
            {
                type: 'input',
                name: 'ticket',
                message: 'Enter Jira ticket key:',
                default: options.ticket,
                validate: (input) => /^[A-Z]+-\d+$/.test(input) || 'Invalid Jira ticket key'
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
                name: 'output',
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
        const ticket = answers.ticket;
        const env = answers.environment;
        const output = answers.output;
        const overwrite = answers.overwrite;
        if (!ENV_URLS[env]) {
            spinner.fail(`No URL configured for environment "${env}". Check your .env file.`);
            process.exit(1);
        }
        if (fs.existsSync(output) && !overwrite) {
            spinner.fail(`File ${output} already exists. Use --overwrite to replace it.`);
            process.exit(1);
        }
        spinner.succeed('Configuration built successfully');
        const mcp = new MCPService();
        // Interactive dev intervention handler
        const onIntervention = async (step) => {
            // If step 1, update the prompt to show the actual environment URL
            let promptEnvUrl = '';
            if (step.stepIndex === 0 && ENV_URLS[env]) {
                promptEnvUrl = ENV_URLS[env];
            }
            console.log(chalk.yellow(`\n🔄 Step ${step.stepIndex + 1}: ${step.description}`));
            if (promptEnvUrl) {
                console.log(chalk.magenta(`🌐 Environment URL: ${promptEnvUrl}`));
            }
            console.log(chalk.cyan(`💡 Suggested code:\n${step.suggestedCode}`));
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
            }
            else if (action === 'edit') {
                const { customCode } = await inquirer.prompt([
                    {
                        type: 'input',
                        name: 'customCode',
                        message: 'Type your custom code for this step:'
                    }
                ]);
                return customCode;
            }
            else if (action === 'skip') {
                return '// Step skipped by developer';
            }
            else if (action === 'debug') {
                console.log(chalk.magenta('🐛 Debug mode - test generation paused. Do your manual investigation now.'));
                await inquirer.prompt([{ type: 'input', name: 'continue', message: 'Press ENTER to continue...' }]);
                return step.suggestedCode;
            }
            return step.suggestedCode;
        };
        const genSpinner = ora('Generating Playwright test...').start();
        const result = await mcp.generateTestFromTicket({ ticket, env, outputPath: output }, onIntervention);
        genSpinner.succeed('Test generated!');
        // Ensure output directory exists
        const outputDir = path.dirname(output);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        fs.writeFileSync(output, result.code, 'utf-8');
        console.log(chalk.green(`\n✅ Test generated: ${output}`));
        console.log(chalk.blue(`📋 Ticket: ${ticket}`));
        console.log(chalk.blue(`🎯 Environment: ${env} (${ENV_URLS[env]})`));
        console.log(chalk.blue(`📁 Output: ${output}`));
        console.log(chalk.blue(`🧪 Test name: ${result.testName}`));
        console.log(chalk.blue(`📊 Steps: ${result.steps.length}`));
        result.steps.forEach((step, i) => {
            console.log(chalk.gray(`   ${i + 1}. ${step}`));
        });
    }
    catch (error) {
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
    console.log(chalk.green('🔧 Self-healing result:'), result);
});
program.parse();
//# sourceMappingURL=cli-enhanced.js.map