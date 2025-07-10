#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const main_1 = __importDefault(require("./main"));
const program = new commander_1.Command();
program
    .name('playwright-test-generator')
    .description('AI-powered CLI to generate Playwright tests from Jira tickets.')
    .version('1.0.0');
program
    .command('gen')
    .description('Generate a Playwright test from a Jira ticket')
    .action(main_1.default);
program.parse(process.argv);
