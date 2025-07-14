import { config } from './config';
import { OpenAI } from 'openai';
import kbActions from '../knowledgebase/actions.json';

const openai = new OpenAI({ apiKey: config.openaiApiKey });

function getPlaywrightStepsForActions(actions: string[]): string {
  let steps = '';
  for (const action of actions) {
    const found = kbActions.find((a: any) => a.action && action.toLowerCase().includes(a.action.toLowerCase()));
    if (found && found.playwright) {
      steps += found.playwright.join('\n') + '\n';
    } else if (found && found.steps) {
      steps += '// Steps: ' + found.steps.join(' | ') + '\n';
    }
  }
  return steps;
}

export async function generatePlaywrightTest({
  jiraTitle,
  jiraDescription,
  acceptanceCriteria,
  ragResults,
  requiredEntities,
  mockData,
  sourceContext,
  testDomain,
  loginCredentials,
  spotData
}: {
  jiraTitle: string;
  jiraDescription: string;
  acceptanceCriteria?: string;
  ragResults?: Array<{ title: string; url: string; content: string; score: number }>;
  requiredEntities?: string[];
  mockData?: any;
  sourceContext: string;
  testDomain?: string;
  loginCredentials?: { email: string; password: string };
  spotData?: any;
}): Promise<string> {
  // Extract relevant actions from the JIRA description
  const actionsToRun = [
    'login as Demo Prod Director',
    'create spot with file attachment',
    'send email from notes section',
    'verify email notification',
    'assign POC to spot'
  ];
  const playwrightSteps = getPlaywrightStepsForActions(actionsToRun);

  let prompt = `You are an expert Playwright test author. Write a production-quality Playwright test in TypeScript for the following JIRA card and business workflow. Use the provided selectors, workflows, and valid user credentials. Output only the Playwright test code (no markdown fences, no code block markers, no triple backticks).
`;
  prompt += `JIRA Title: ${jiraTitle}\nJIRA Description: ${jiraDescription}`;
  if (acceptanceCriteria) prompt += `\nAcceptance Criteria: ${acceptanceCriteria}`;
  if (testDomain) prompt += `\nTest Domain: ${testDomain}`;
  if (loginCredentials) prompt += `\nLogin Credentials: ${JSON.stringify(loginCredentials)}`;
  if (spotData) prompt += `\nSpot Data: ${JSON.stringify(spotData)}`;
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
  if (!result) throw new Error('No response from OpenAI.');
  return result.trim();
}
