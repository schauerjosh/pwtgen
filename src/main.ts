import { config } from './config';
import { exec } from 'child_process';
import inquirer from 'inquirer';
import { fetchJiraIssue } from './jira';
import { generatePlaywrightTest } from './openai';
import fs from 'fs';
import path from 'path';
const axios = require('axios');
import kbActions from '../knowledgebase/actions.json';
import articleEmbeddings from '../knowledgebase/article_embeddings.json';
import articles from '../knowledgebase/articles.json';

const ENV_URLS = {
  prod: 'https://vcreative.net/',
  twotest: 'https://two-test.vcreative.net/',
  smoke: 'https://smoketest.vcreative.net/',
  qa: 'https://qa.vcreative.net/',
  local: 'http://localhost:4200',
};

function getActionSteps(actionName: string) {
  const found = kbActions.find((a: any) => a.action.toLowerCase().includes(actionName.toLowerCase()));
  return found ? found.steps : [];
}

async function getQueryEmbedding(query: string) {
  const openai = new (require('openai')).OpenAI({ apiKey: config.openaiApiKey });
  const response = await openai.embeddings.create({
    model: 'text-embedding-ada-002',
    input: query,
  });
  return response.data[0].embedding;
}

function cosineSimilarity(a: number[], b: number[]) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function semanticSearch(query: string, topN = 3) {
  const queryEmbedding = await getQueryEmbedding(query);
  const scored = articleEmbeddings.map((item: any, idx: number) => ({
    idx,
    score: cosineSimilarity(queryEmbedding, item.embedding)
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topN).map(({ idx, score }) => ({
    ...articles[idx],
    score
  }));
}

export async function handleFromJiraCommand() {
  // Prompt for Jira ticket number only
  const { jiraTicket } = await inquirer.prompt([
    {
      type: 'input',
      name: 'jiraTicket',
      message: 'Enter the Jira ticket number:',
      validate: (input) => input ? true : 'Jira ticket number is required.'
    }
  ]);

  // Fetch Jira ticket data and return the title
  try {
    const issue = await fetchJiraIssue(jiraTicket);
    const title = issue.fields.summary;
    let description = '';
    if (typeof issue.fields.description === 'string') {
      description = issue.fields.description;
    } else if (issue.fields.description && issue.fields.description.content) {
      description = issue.fields.description.content.map((c: any) => c.content?.map((cc: any) => cc.text).join(' ')).join(' ');
    }
    const acceptanceCriteria = issue.fields.customfield_10031 ? JSON.stringify(issue.fields.customfield_10031) : undefined;
    console.log(`\nTitle of ${jiraTicket}: ${title}`);

    // Prompt for source code context
    const { sourcePaths } = await inquirer.prompt([
      {
        type: 'input',
        name: 'sourcePaths',
        message: 'Enter relative paths to source code files/folders for UI selectors/components (comma-separated):',
        default: 'src/',
        filter: (input) => input.split(',').map((s: string) => s.trim()).filter(Boolean)
      }
    ]);
    let sourceContext = '';
    for (const relPath of sourcePaths) {
      try {
        const absPath = path.resolve(relPath);
        if (fs.existsSync(absPath)) {
          if (fs.lstatSync(absPath).isDirectory()) {
            const files = fs.readdirSync(absPath).filter(f => f.endsWith('.ts') || f.endsWith('.tsx') || f.endsWith('.js'));
            for (const file of files) {
              sourceContext += `\n// File: ${file}\n` + fs.readFileSync(path.join(absPath, file), 'utf8');
            }
          } else {
            sourceContext += `\n// File: ${relPath}\n` + fs.readFileSync(absPath, 'utf8');
          }
        }
      } catch {}
    }

    // Detect login in description/acceptance criteria
    const loginDetected = /login|sign in|log in|authenticate/i.test(description + (acceptanceCriteria || ''));
    let loginCredentials = undefined;
    if (loginDetected) {
      loginCredentials = await inquirer.prompt([
        {
          type: 'input',
          name: 'username',
          message: 'Login detected. Enter username to use in the test:',
          default: 'testuser'
        },
        {
          type: 'input',
          name: 'password',
          message: 'Enter password to use in the test:',
          default: 'password123'
        }
      ]);
    }

    // Prompt for domain to run the Playwright test at
    const { testDomain } = await inquirer.prompt([
      {
        type: 'input',
        name: 'testDomain',
        message: 'Enter the domain/URL where this Playwright test should run:',
        default: 'https://example.com'
      }
    ]);

    // --- New: Extract actions/roles from card description and acceptance criteria ---
    const cardText = `${title}\n${description}\n${acceptanceCriteria || ''}`;
    // Example: extract phrases like "log in as ...", "as ...", "navigate to ...", "select ..."
    const actionRegex = /(log in as [\w ]+|as [A-Za-z ]+|navigate to [\w ]+|select [\w ]+)/gi;
    const actionsFound = Array.from(cardText.matchAll(actionRegex)).map(m => m[0]);
    if (actionsFound.length) {
      console.log('\nDetected actions/roles in card:');
      actionsFound.forEach((a, i) => console.log(`  [${i+1}] ${a}`));
      // For each action, query the knowledge base
      for (const action of actionsFound) {
        console.log(`\nSearching knowledge base for: "${action}" ...`);
        const results = await semanticSearch(action, 2);
        results.forEach((res, i) => {
          console.log(`  [${i+1}] ${res.title}\n  URL: ${res.url}\n  Score: ${res.score.toFixed(3)}\n  Content: ${res.content.slice(0, 300)}...`);
        });
      }
    } else {
      console.log('\nNo explicit actions/roles detected in card.');
    }

    // --- Step: Detect required entities from card ---
    const entityKeywords = [
      { key: 'spot', regex: /spot|spot data|spot info/i },
      { key: 'user', regex: /user|login as|sign in as|authenticate as/i },
      { key: 'station', regex: /station|broadcast station/i },
      { key: 'firm', regex: /firm|firm id/i },
      { key: 'adtype', regex: /adtype|ad type/i }
    ];
    const requiredEntities = entityKeywords.filter(e => e.regex.test(cardText)).map(e => e.key);
    if (requiredEntities.length) {
      console.log(`\nEntities required for this test (detected from card): ${requiredEntities.join(', ')}`);
    } else {
      console.log('\nNo specific entities detected from card.');
    }

    // --- Step: Prompt for mock data usage ---
    let useMockData = false;
    if (requiredEntities.length) {
      const { mockChoice } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'mockChoice',
          message: `Do you want to use mock data for the required entities (${requiredEntities.join(', ')})?`,
          default: true
        }
      ]);
      useMockData = mockChoice;
    }

    // --- Step: Load mock data if chosen ---
    let mockData: any = {};
    if (useMockData) {
      // Only use spotPresets.valid for spot, and similar for other entities
      try {
        if (requiredEntities.includes('spot')) {
          const { spotPresets } = require('../app/mock-data/spot-mock');
          mockData.spot = spotPresets.valid;
          console.log('\nUsing mock spot data (spotPresets.valid):', mockData.spot);
        }
        if (requiredEntities.includes('user')) {
          const { userPresets } = require('../app/mock-data/user-mock');
          mockData.user = userPresets.valid;
          console.log('\nUsing mock user data (userPresets.valid):', mockData.user);
        }
        if (requiredEntities.includes('station')) {
          const { stationPresets } = require('../app/mock-data/station-mock');
          mockData.station = stationPresets.valid;
          console.log('\nUsing mock station data (stationPresets.valid):', mockData.station);
        }
        if (requiredEntities.includes('firm')) {
          const { firmPresets } = require('../app/mock-data/firm-mock');
          mockData.firm = firmPresets.valid;
          console.log('\nUsing mock firm data (firmPresets.valid):', mockData.firm);
        }
        if (requiredEntities.includes('adtype')) {
          const { adtypePresets } = require('../app/mock-data/adtype-mock');
          mockData.adtype = adtypePresets.valid;
          console.log('\nUsing mock adtype data (adtypePresets.valid):', mockData.adtype);
        }
      } catch (err) {
        console.log('Error loading mock data:', err);
      }
    }

    // --- Step: Prompt for file location for Playwright test ---
    const { testPath } = await inquirer.prompt([
      {
        type: 'input',
        name: 'testPath',
        message: 'Path to save the Playwright test file:',
        default: path.join('tests', `${jiraTicket}.spec.ts`),
        validate: (input) => input ? true : 'Test file path is required.'
      }
    ]);
    const absPath = path.resolve(testPath);

    // --- Step: Prompt for any specific data needed ---
    // If not using mock data, prompt for manual entry for each required entity
    if (!useMockData && requiredEntities.length) {
      for (const entity of requiredEntities) {
        const { entityData } = await inquirer.prompt([
          {
            type: 'input',
            name: 'entityData',
            message: `Enter data for required entity (${entity}) or leave blank to skip:`,
            default: ''
          }
        ]);
        mockData[entity] = entityData || undefined;
      }
    }

    // --- Step: Display summary to developer ---
    console.log('\nSummary:');
    console.log(`JIRA Ticket: ${jiraTicket}`);
    console.log(`Test file location: ${absPath}`);
    if (requiredEntities.length) {
      console.log(`Required entities: ${requiredEntities.join(', ')}`);
      if (useMockData) {
        console.log('Using mock data for entities.');
      } else {
        console.log('Using provided data for entities.');
      }
    }

    // Generate Playwright test using OpenAI
    console.log('\nGenerating Playwright test using OpenAI...');
    const testCode = await generatePlaywrightTest({
      sourceContext,
      testDomain
    });
    console.log('\nGenerated Playwright Test:\n');
    console.log(testCode);

    // Prompt for file path
    const defaultPath = path.join('tests', `${jiraTicket}.spec.ts`);
    const { testPath: finalTestPath } = await inquirer.prompt([
      {
        type: 'input',
        name: 'testPath',
        message: 'Path to save the test file:',
        default: defaultPath,
        validate: (input) => input ? true : 'Test file path is required.'
      }
    ]);
    const finalAbsPath = path.resolve(finalTestPath);
    let writeMode: 'new' | 'append' = 'new';
    if (fs.existsSync(finalAbsPath)) {
      const { append } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'append',
          message: `File ${finalTestPath} exists. Append to it? (No will overwrite)`,
          default: true
        }
      ]);
      writeMode = append ? 'append' : 'new';
    }
    // Ensure directory exists
    fs.mkdirSync(path.dirname(finalAbsPath), { recursive: true });
    if (writeMode === 'new') {
      // Write full test file
      fs.writeFileSync(finalAbsPath, testCode, 'utf8');
      console.log(`\nTest file created: ${finalAbsPath}`);
    } else {
      // Append only the test() block
      const testBlockMatch = testCode.match(/(test\s*\(.*[\s\S]*)/);
      if (testBlockMatch) {
        fs.appendFileSync(finalAbsPath, '\n' + testBlockMatch[1], 'utf8');
        console.log(`\nTest block appended to: ${finalAbsPath}`);
      } else {
        console.error('Could not find a test() block to append.');
      }
    }
  } catch (err: any) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

async function fetchJiraUrl(jiraNumber: string, jiraBaseUrl: string, jiraEmail: string, jiraToken: string) {
  const issueUrl = `${jiraBaseUrl}/rest/api/3/issue/${jiraNumber}`;
  try {
    const response = await axios.get(issueUrl, {
      auth: {
        username: jiraEmail,
        password: jiraToken,
      },
    });
    // Try to extract a URL from the issue fields (customize as needed)
    const fields = response.data.fields;
    // Example: look for a field named 'url' or similar
    const url = fields.url || fields.customfield_12345 || '';
    return url;
  } catch (error) {
    if (error instanceof Error) {
      console.error('Failed to fetch JIRA issue:', error.message);
    } else {
      console.error('Failed to fetch JIRA issue:', error);
    }
    return '';
  }
}

async function recordPlaywrightTest(url: string, testPath: string) {
  console.log(`\nA browser window will open to: ${url}`);
  console.log('Perform your test actions in the browser.');
  console.log('When you are done, CLOSE the browser window.');
  console.log('Your actions will be automatically captured and saved as a Playwright test.');
  console.log('You do NOT need to copy/paste anything.');
  console.log('The CLI will confirm the test file location after you finish.\n');
  return new Promise((resolve, reject) => {
    const cmd = url ? `npx playwright codegen ${url} --output ${testPath}` : `npx playwright codegen --output ${testPath}`;
    const child = exec(cmd, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        // Inject wait and assertion after page.goto in the generated test
        let testCode = fs.readFileSync(testPath, 'utf8');
        testCode = testCode.replace(
          /(await page\.goto\(['"].+?['"]\);?)/,
          `$1\n  await page.waitForLoadState('networkidle');\n  await expect(page).toHaveURL('${url}');`
        );
        fs.writeFileSync(testPath, testCode, 'utf8');
        console.log(`\n✅ Playwright test actions have been captured and saved to: ${testPath}`);
        console.log('You can now commit and push this file to your repo.');
        resolve(stdout);
      }
    });
    if (child.stdout) child.stdout.pipe(process.stdout);
    if (child.stderr) child.stderr.pipe(process.stderr);
  });
}

async function handleRecordCommand() {
  console.log('\nINSTRUCTIONS:');
  console.log('1. You will select the environment and specify the file location for your Playwright test.');
  console.log('2. A browser window will open to the selected environment URL.');
  console.log('3. Perform your test actions in the browser.');
  console.log('4. When you are done, CLOSE the browser window.');
  console.log('5. Your actions will be automatically captured and saved as a Playwright test in the file you specify.');
  console.log('6. To run your new test, use: npx playwright test <path-to-your-test-file>');
  console.log('');

  const { env } = await inquirer.prompt([
    {
      type: 'list',
      name: 'env',
      message: 'Select the environment:',
      choices: [
        { name: `prod (${ENV_URLS.prod})`, value: 'prod' },
        { name: `twotest (${ENV_URLS.twotest})`, value: 'twotest' },
        { name: `smoke (${ENV_URLS.smoke})`, value: 'smoke' },
        { name: `qa (${ENV_URLS.qa})`, value: 'qa' },
        { name: `local (${ENV_URLS.local})`, value: 'local' },
      ],
      default: 'twotest',
    },
  ]);
  const url = ENV_URLS[env as keyof typeof ENV_URLS];

  // Prompt for login credentials
  let loginCredentials = undefined;
  const { wantsLogin } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'wantsLogin',
      message: 'Do you want to provide login credentials (email/password)?',
      default: false,
    },
  ]);
  if (wantsLogin) {
    loginCredentials = await inquirer.prompt([
      {
        type: 'input',
        name: 'email',
        message: 'Enter user email:',
      },
      {
        type: 'input',
        name: 'password',
        message: 'Enter user password:',
      },
    ]);
    const { saveFixture } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'saveFixture',
        message: 'Do you want to save these credentials as a fixture?',
        default: true,
      },
    ]);
    if (saveFixture) {
      const usersDir = path.join('playwright', 'fixtures', 'users');
      fs.mkdirSync(usersDir, { recursive: true });
      const usersFile = path.join(usersDir, 'users.json');
      let users = [];
      if (fs.existsSync(usersFile)) {
        try {
          users = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
        } catch {}
      }
      users.push(loginCredentials);
      fs.writeFileSync(usersFile, JSON.stringify(users, null, 2), 'utf8');
      console.log(`\n✅ Credentials saved to ${usersFile}`);
    }
  }

  // Prompt for spot data or mock files
  const { wantsSpotData } = await inquirer.prompt([
    {
      type: 'list',
      name: 'wantsSpotData',
      message: 'Do you want to provide specific spot data or use mock files?',
      choices: [
        { name: 'Provide specific spot data', value: 'specific' },
        { name: 'Use mock files', value: 'mock' },
        { name: 'No spot data needed', value: 'none' },
      ],
      default: 'none',
    },
  ]);
  if (wantsSpotData === 'specific') {
    const spotDetails = await inquirer.prompt([
      {
        type: 'input',
        name: 'user',
        message: 'Which user? (email address)',
      },
      {
        type: 'input',
        name: 'adtype',
        message: 'Which adtype?',
      },
      {
        type: 'input',
        name: 'stations',
        message: 'Which stations?',
      },
      {
        type: 'input',
        name: 'spotTitle',
        message: 'Spot title?',
      },
      {
        type: 'input',
        name: 'startDate',
        message: 'Start date?',
      },
      {
        type: 'input',
        name: 'endDate',
        message: 'End date?',
      },
      {
        type: 'input',
        name: 'dueDate',
        message: 'Due date?',
      },
      {
        type: 'input',
        name: 'status',
        message: 'Status?',
      },
    ]);
    const spotsDir = path.join('playwright', 'fixtures', 'spots');
    fs.mkdirSync(spotsDir, { recursive: true });
    const spotsFile = path.join(spotsDir, 'spots.json');
    let spots = [];
    if (fs.existsSync(spotsFile)) {
      try {
        spots = JSON.parse(fs.readFileSync(spotsFile, 'utf8'));
      } catch {}
    }
    spots.push(spotDetails);
    fs.writeFileSync(spotsFile, JSON.stringify(spots, null, 2), 'utf8');
    console.log(`\n✅ Spot data saved to ${spotsFile}`);
  } else if (wantsSpotData === 'mock') {
    console.log('\nUsing mock spot data files.');
    // Optionally copy or reference mock files here
  }

  const { testPath: rawTestPath } = await inquirer.prompt([
    {
      type: 'input',
      name: 'testPath',
      message: 'Path to save the test file:',
      default: 'tests/generated',
      validate: (input) => input ? true : 'Test file path is required.'
    }
  ]);
  // Ensure .test.ts is appended
  const testPath = rawTestPath.endsWith('.test.ts') ? rawTestPath : `${rawTestPath}.test.ts`;

  await recordPlaywrightTest(url, testPath);

  // Prompt to run the test
  const { runTest } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'runTest',
      message: `Do you want to run the newly created test now?`,
      default: true,
    },
  ]);
  if (runTest) {
    const { execSync } = require('child_process');
    try {
      console.log(`\nRunning: PWDEBUG=1 npx playwright test ${testPath}\n`);
      execSync(`PWDEBUG=1 npx playwright test ${testPath}`, { stdio: 'inherit' });
    } catch (err) {
      if (err instanceof Error) {
        console.error('Error running the test:', err.message);
      } else {
        console.error('Error running the test:', err);
      }
    }
  }
}

module.exports = { handleRecordCommand };
