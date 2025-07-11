import { config } from './config';
import { OpenAI } from 'openai';

const openai = new OpenAI({ apiKey: config.openaiApiKey });

export async function generatePlaywrightTest({
  title,
  description,
  acceptanceCriteria,
  sourceContext,
  loginCredentials,
  testDomain
}: {
  title: string;
  description: string;
  acceptanceCriteria?: string;
  sourceContext?: string;
  loginCredentials?: { username: string; password: string };
  testDomain?: string;
}): Promise<string> {
  let prompt = `You are an expert Playwright test author. Write a production-quality Playwright test in TypeScript for the following Jira ticket.\n`;
  prompt += `Title: ${title}\n`;
  prompt += `Description: ${description}\n`;
  if (acceptanceCriteria) {
    prompt += `Acceptance Criteria: ${acceptanceCriteria}\n`;
  }
  if (sourceContext) {
    prompt += `\nRelevant source code context from the repo:\n${sourceContext}\n`;
  }
  if (loginCredentials) {
    prompt += `\nUse the following credentials for login in the test:\nUsername: ${loginCredentials.username}\nPassword: ${loginCredentials.password}\n`;
  }
  if (testDomain) {
    prompt += `\nRun the Playwright test at this domain/URL: ${testDomain}\n`;
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
