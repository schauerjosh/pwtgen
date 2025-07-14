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
    // Always use canonical login snippet and interpolate ENV_URL, USER_EMAIL, USER_PASSWORD
    return playwrightSnippets.login.snippet.map(s =>
      s.replace('<ENV_URL>', context.testDomain || process.env.TEST_DOMAIN || '')
       .replace('<USER_EMAIL>', context.loginCredentials?.email || '')
       .replace('<USER_PASSWORD>', context.loginCredentials?.password || '')
    ).join('\n');
  }
  if (action === 'spotCreation') {
    // Always use canonical spot creation snippet and valid mock data
    const spotData = context.spotData || {};
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
  spotData,
  devResponse
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
  devResponse?: string;
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

  // Strict canonical snippet injection
  const loginSnippet = playwrightSnippets.login.snippet.map(s =>
    s.replace('<ENV_URL>', testDomain || process.env.TEST_DOMAIN || '')
     .replace('<USER_EMAIL>', loginCredentials?.email || '')
     .replace('<USER_PASSWORD>', loginCredentials?.password || '')
  ).join('\n');
  const spotSnippet = playwrightSnippets.spotCreation.snippet.map(s => {
    const spot = entityMockData.spot || spotData || {};
    return s
      .replace('${spotData.adType}', spot.metadata?.adtype_id || spot.adtype_id || '')
      .replace('spotData.client', spot.metadata?.client_id || spot.client_id || '')
      .replace('spotData.title', spot.spot_title || '')
      .replace('spotData.isci', spot.metadata?.draft_id || spot.isci || '')
      .replace('spotData.length', spot.metadata?.spot_length || spot.length || '')
      .replace('spotData.rotation', spot.metadata?.rotationpercent || spot.rotation || '')
      .replace('spotData.contract', spot.metadata?.contractno || spot.contract || '')
      .replace('spotData.filePath', spot.metadata?.spot_files?.[0]?.file_name || 'valid_file_1.mp4');
  }).join('\n');

  let prompt = `You are an expert Playwright test author. Write a production-quality Playwright test in TypeScript for the following JIRA card and business workflow.\n`;
  prompt += `JIRA Title: ${jiraTitle}\nJIRA Description: ${jiraDescription}`;
  if (acceptanceCriteria) prompt += `\nAcceptance Criteria: ${acceptanceCriteria}`;
  if (devResponse) prompt += `\nDeveloper Response: ${devResponse}`;
  if (testDomain) prompt += `\nTest Domain: ${testDomain}`;
  if (loginCredentials) {
    prompt += `\nLogin Credentials: ${JSON.stringify(loginCredentials)}`;
    prompt += `\nIMPORTANT: The following email and password will be used for login in the test. Please verify and use exactly these values:`;
    prompt += `\nEmail: ${loginCredentials.email}`;
    prompt += `\nPassword: ${loginCredentials.password}`;
  }
  Object.keys(entityMockData).forEach(entity => {
    prompt += `\n${entity.charAt(0).toUpperCase() + entity.slice(1)} Data: ${JSON.stringify(entityMockData[entity])}`;
  });
  prompt += `\nUse ONLY the following canonical Playwright code blocks for login and spot creation. Do NOT use generic or manual steps.\n`;
  prompt += `\nCanonical Login Workflow:\n${loginSnippet}\n`;
  prompt += `\nCanonical Spot Creation Workflow:\n${spotSnippet}\n`;
  prompt += `\nIf other business actions are required, use only canonical workflows and selectors from the knowledge base. Output only the Playwright test code. Do NOT include markdown code block markers or triple backticks.`;

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
