#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const main_1 = require("./main");
const program = new commander_1.Command();
program
    .name('playwright-test-generator')
    .description('AI-powered CLI to generate Playwright tests from Jira tickets.')
    .version('1.0.0');
program
    .command('record')
    .description('Launch a browser and record Playwright actions to generate a test (JIRA integration included)')
    .action(async () => {
    await (0, main_1.handleRecordCommand)();
});
program
    .command('from-jira')
    .description('Automate Playwright test generation from a JIRA card using semantic search and RAG')
    .action(async () => {
    await (0, main_1.handleFromJiraCommand)();
});
program.parse(process.argv);
