"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generatePlaywrightTest = generatePlaywrightTest;
const config_1 = require("./config");
const openai_1 = require("openai");
const openai = new openai_1.OpenAI({ apiKey: config_1.config.openaiApiKey });
async function generatePlaywrightTest({ title, description, acceptanceCriteria }) {
    let prompt = `You are an expert Playwright test author. Write a production-quality Playwright test in TypeScript for the following Jira ticket.\n`;
    prompt += `Title: ${title}\n`;
    prompt += `Description: ${description}\n`;
    if (acceptanceCriteria) {
        prompt += `Acceptance Criteria: ${acceptanceCriteria}\n`;
    }
    prompt += `\nDo not hallucinate selectors or UI. Only use information provided. Output only the test code.`;
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
