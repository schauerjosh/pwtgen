#!/usr/bin/env node
import { Command } from 'commander';
import main from './main';

const program = new Command();

program
  .name('playwright-test-generator')
  .description('AI-powered CLI to generate Playwright tests from Jira tickets.')
  .version('1.0.0');

program
  .command('gen')
  .description('Generate a Playwright test from a Jira ticket')
  .action(main);

program.parse(process.argv);
