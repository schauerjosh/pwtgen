import { config } from './config';
import { OpenAI } from 'openai';

const openai = new OpenAI({ apiKey: config.openaiApiKey });

export async function generatePlaywrightTest({
  sourceContext,
  testDomain
}: {
  sourceContext: string;
  testDomain?: string;
}): Promise<string> {
  let prompt = `You are an expert Playwright test author. Write a production-quality Playwright test in TypeScript based only on the following recorded browser session events. Do not use any Jira ticket information. Use only the provided session data to infer selectors, actions, and validations. Output only the test code.`;
  if (testDomain) {
    prompt += `\nTest URL: ${testDomain}`;
  }
  if (sourceContext) {
    prompt += `\nSession events:\n${sourceContext}`;
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
  if (!result) throw new Error('No response from OpenAI.');
  return result.trim();
}
