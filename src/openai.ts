import { config } from './config';
import { OpenAI } from 'openai';
import kbActions from '../knowledgebase/actions.json';
import playwrightSnippets from '../knowledgebase/playwrightSnippets.json';
import { spotPresets } from './spotPresets';
import { buildAdtypeData } from './mock-data/adtype-mock';
import { buildFirmData } from './mock-data/firm-mock';
import { buildSpotData } from './mock-data/spot-mock';
import { buildSpotVoiceData } from './mock-data/spot-voices-mock';
import { buildSpotFileData } from './mock-data/spotFile-mock';
import { buildSpotJobsData } from './mock-data/spotJobs-mock';
import { buildStationData } from './mock-data/station-mock';
import { buildUserData } from './mock-data/user-mock';

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

function getCanonicalPlaywrightSteps(action: string, context: any = {}) {
  if (action === 'login') {
    return playwrightSnippets.login.snippet.map(s =>
      s.replace('<ENV_URL>', context.testDomain || '')
       .replace('<USER_EMAIL>', context.loginCredentials?.email || '')
       .replace('<USER_PASSWORD>', context.loginCredentials?.password || '')
    ).join('\n');
  }
  if (action === 'spotCreation') {
    // Use spotPresets.valid if no spotData provided
    const spotData = context.spotData || spotPresets.valid;
    return playwrightSnippets.spotCreation.snippet.map(s => {
      return s
        .replace('${spotData.adType}', spotData.metadata?.adtype_id || spotData.adtype_id || '')
        .replace('spotData.client', spotData.metadata?.client_id || spotData.client_id || '')
        .replace('spotData.title', spotData.spot_title || '')
        .replace('spotData.isci', spotData.metadata?.draft_id || spotData.isci || '')
        .replace('spotData.length', spotData.metadata?.spot_length || spotData.length || '')
        .replace('spotData.rotation', spotData.metadata?.rotationpercent || spotData.rotation || '')
        .replace('spotData.contract', spotData.metadata?.contractno || spotData.contract || '')
        .replace('spotData.filePath', spotData.metadata?.spot_files?.[0]?.file_name || 'valid_file_1.mp4');
    }).join('\n');
  }
  return '';
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
  // Only use selectors and workflows from top RAG results
  let actionsToRun: string[] = [];
  if (ragResults && ragResults.length) {
    for (const res of ragResults) {
      if (/login/i.test(res.content)) actionsToRun.push('login');
      if (/create (a )?spot|quick order|qo/i.test(res.content)) actionsToRun.push('spotCreation');
      if (/playwright|selector|workflow|order|spot|approval|dubbed|checkbox|hover|POC/i.test(res.content)) {
        actionsToRun.push(res.content);
      }
    }
  }
  // Fallback if not enough coverage
  if (!actionsToRun.length) {
    return '// Not enough RAG coverage. Please use the Playwright recorder for manual workflow.';
  }

  // Conditionally build mock data for requested entities
  let entityMockData: Record<string, any> = {};
  if (requiredEntities && requiredEntities.length) {
    if (requiredEntities.includes('adtype')) entityMockData.adtype = buildAdtypeData();
    if (requiredEntities.includes('firm')) entityMockData.firm = buildFirmData();
    if (requiredEntities.includes('spot')) entityMockData.spot = buildSpotData();
    if (requiredEntities.includes('spot-voices')) entityMockData.spotVoices = buildSpotVoiceData();
    if (requiredEntities.includes('spotFile')) entityMockData.spotFile = buildSpotFileData();
    if (requiredEntities.includes('spotJobs')) entityMockData.spotJobs = buildSpotJobsData();
    if (requiredEntities.includes('station')) entityMockData.station = buildStationData();
    if (requiredEntities.includes('user')) entityMockData.user = buildUserData();
  }

  let playwrightSteps = '';
  for (const action of actionsToRun) {
    playwrightSteps += getCanonicalPlaywrightSteps(action, { testDomain, loginCredentials, spotData: entityMockData.spot }) + '\n';
  }

  let prompt = `You are an expert Playwright test author. Write a production-quality Playwright test in TypeScript for the following JIRA card and business workflow. Use the provided selectors, workflows, and valid user credentials. Output only the Playwright test code (no markdown fences, no code block markers, no triple backticks).
`;
  prompt += `JIRA Title: ${jiraTitle}\nJIRA Description: ${jiraDescription}`;
  if (acceptanceCriteria) prompt += `\nAcceptance Criteria: ${acceptanceCriteria}`;
  if (testDomain) prompt += `\nTest Domain: ${testDomain}`;
  if (loginCredentials) prompt += `\nLogin Credentials: ${JSON.stringify(loginCredentials)}`;
  // Only include mock data for requested entities
  Object.keys(entityMockData).forEach(entity => {
    prompt += `\n${entity.charAt(0).toUpperCase() + entity.slice(1)} Data: ${JSON.stringify(entityMockData[entity])}`;
  });
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
