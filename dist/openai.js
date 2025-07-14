"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generatePlaywrightTest = generatePlaywrightTest;
const config_1 = require("./config");
const openai_1 = require("openai");
const actions_json_1 = __importDefault(require("../knowledgebase/actions.json"));
const openai = new openai_1.OpenAI({ apiKey: config_1.config.openaiApiKey });
function getPlaywrightStepsForActions(actions) {
    let steps = '';
    for (const action of actions) {
        const found = actions_json_1.default.find((a) => a.action && action.toLowerCase().includes(a.action.toLowerCase()));
        if (found && found.playwright) {
            steps += found.playwright.join('\n') + '\n';
        }
        else if (found && found.steps) {
            steps += '// Steps: ' + found.steps.join(' | ') + '\n';
        }
    }
    return steps;
}
async function generatePlaywrightTest({ jiraTitle, jiraDescription, acceptanceCriteria, ragResults, requiredEntities, mockData, sourceContext, testDomain, loginCredentials, spotData }) {
    // Only use selectors and workflows from top RAG results
    let actionsToRun = [];
    if (ragResults && ragResults.length) {
        for (const res of ragResults) {
            if (/playwright|selector|workflow|order|spot|approval|dubbed|checkbox|hover|POC/i.test(res.content)) {
                actionsToRun.push(res.content);
            }
        }
    }
    // Fallback if not enough coverage
    if (!actionsToRun.length) {
        return '// Not enough RAG coverage. Please use the Playwright recorder for manual workflow.';
    }
    const playwrightSteps = getPlaywrightStepsForActions(actionsToRun);
    let prompt = `You are an expert Playwright test author. Write a production-quality Playwright test in TypeScript for the following JIRA card and business workflow. Use the provided selectors, workflows, and valid user credentials. Output only the Playwright test code (no markdown fences, no code block markers, no triple backticks).
`;
    prompt += `JIRA Title: ${jiraTitle}\nJIRA Description: ${jiraDescription}`;
    if (acceptanceCriteria)
        prompt += `\nAcceptance Criteria: ${acceptanceCriteria}`;
    if (testDomain)
        prompt += `\nTest Domain: ${testDomain}`;
    if (loginCredentials)
        prompt += `\nLogin Credentials: ${JSON.stringify(loginCredentials)}`;
    if (spotData)
        prompt += `\nSpot Data: ${JSON.stringify(spotData)}`;
    prompt += `\nUse these Playwright steps and selectors for the workflow:\n${playwrightSteps}`;
    prompt += `\nWrite a Playwright test that automates login, spot creation, file upload, email sending, and verification as described. Use only the provided selectors and workflows. Output only the Playwright test code. Do NOT include markdown code block markers or triple backticks.`;
    const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        temperature: 0.1,
        messages: [
            { role: 'system', content: 'You are a senior QA automation engineer.' },
            { role: 'user', content: prompt }
        ],
        max_tokens: 1200
    });
    const result = completion.choices[0]?.message?.content;
    if (!result)
        throw new Error('No response from OpenAI.');
    return result.trim();
}
