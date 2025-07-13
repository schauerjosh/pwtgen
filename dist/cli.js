#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const { handleRecordCommand } = require('./main');
const program = new commander_1.Command();
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
program.parse(process.argv);
