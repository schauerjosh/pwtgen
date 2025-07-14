#!/usr/bin/env node
import { Command } from 'commander';
import { handleRecordCommand, handleFromJiraCommand } from './main';

const program = new Command();

program
  .name('playwright-test-generator')
  .description('AI-powered CLI to generate Playwright tests from Jira tickets.')
  .version('1.0.0');

program
  .command('record')
  .description('Launch a browser and record Playwright actions to generate a test (JIRA integration included)')
  .action(async () => {
    await handleRecordCommand();
  });

program
  .command('from-jira')
  .description('Automate Playwright test generation from a JIRA card using semantic search and RAG')
  .action(async () => {
    await handleFromJiraCommand();
  });

program.parse(process.argv);
