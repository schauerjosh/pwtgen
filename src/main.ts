import { config } from './config';
import { exec, execSync } from 'child_process';
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

// Ensure useMockData is defined
let useMockData = false;

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
  // Keywords to boost
  const boostKeywords = [
    'playwright', 'selector', 'workflow', 'order', 'spot', 'approval', 'dubbed', 'checkbox', 'hover', 'POC', 'test', 'automation', 'business action'
  ];
  const scored = articleEmbeddings.map((item: any, idx: number) => {
    let score = cosineSimilarity(queryEmbedding, item.embedding);
    const articleContent = articles[idx].content.toLowerCase();
    // Boost score if keywords are present
    for (const kw of boostKeywords) {
      if (articleContent.includes(kw)) {
        score += 0.15; // Boost value, tune as needed
      }
    }
    // Extra boost for Playwright code blocks
    if (/playwright.*test\s*\(/i.test(articleContent)) {
      score += 0.2;
    }
    return { idx, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topN).map(({ idx, score }) => ({
    ...articles[idx],
    score
  }));
}

// Ensure requiredEntities, mockData, absPath, writeMode are always defined
let requiredEntities: string[] = [];
let mockData: any = {};
let absPath = '';
let writeMode = 'new';

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

    const cardText = `${title}\n${description}\n${acceptanceCriteria || ''}`;

    // --- Prompt for environment selection instead of full URL ---
    const ENV_OPTIONS = [
      { name: 'Production', value: ENV_URLS.prod },
      { name: 'QA', value: ENV_URLS.qa },
      { name: 'Smoke', value: ENV_URLS.smoke },
      { name: 'TwoTest', value: ENV_URLS.twotest },
      { name: 'Local', value: ENV_URLS.local }
    ];
    const { env } = await inquirer.prompt([
      {
        type: 'list',
        name: 'env',
        message: 'Select the environment to run the Playwright test:',
        choices: ENV_OPTIONS
      }
    ]);
    // env is now the actual URL, not a key
    const testDomain = env;

    // --- Extract numbered steps from description ---
    let stepQueries: string[] = [];
    if (description) {
      // Match lines starting with a number and a dot (e.g., '1. Log in')
      const stepLines = description.split(/\n|\r/).filter(line => /^\d+\.\s+/.test(line));
      if (stepLines.length) {
        stepQueries = stepLines.map(line => line.replace(/^\d+\.\s+/, '').trim());
      }
    }

    // --- Query RAG for each step if numbered steps exist ---
    let stepRagResults: any[] = [];
    // Add verbose flag
    const { verbose } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'verbose',
        message: 'Enable verbose debug output for semantic search?',
        default: false
      }
    ]);
    if (stepQueries.length) {
      for (const step of stepQueries) {
        // Scan all articles, print top 20-50 results if verbose
        const results = await semanticSearch(step, 50);
        if (verbose) {
          console.log(`\nSemantic search for step: "${step}"`);
          results.forEach((res: any, i: number) => {
            console.log(`  [${i+1}] ${res.title}\n  Score: ${res.score?.toFixed(3) || ''}\n  Content: ${res.content?.slice(0, 200) || ''}...`);
          });
        }
        stepRagResults.push(...results.slice(0, 5)); // Use top 5 for aggregation
      }
    }

    // --- Composite RAG results: combine step results and main query ---
    let compositeQuery = cardText;
    const actionKeywords = [
      'login', 'sign in', 'authenticate', 'create spot', 'quick order', 'qo', 'file upload', 'attach file', 'send email', 'notes', 'assign poc', 'verify email', 'export', 'spot review'
    ];
    const detectedActions = actionKeywords.filter(kw => new RegExp(kw, 'i').test(cardText));
    if (detectedActions.length) {
      compositeQuery += '\n' + detectedActions.join('\n');
    }
    const ragResults = (await semanticSearch(compositeQuery, 50)).map((res: any) => ({
      title: res.title,
      url: res.url,
      content: res.content.slice(0, 500),
      score: res.score
    }));
    // Merge and deduplicate RAG results
    const allRagResults = [...stepRagResults, ...ragResults].reduce((acc: any[], curr: any) => {
      if (!acc.some((r: any) => r.title === curr.title)) acc.push(curr);
      return acc;
    }, []);
    if (verbose) {
      console.log('\nTop aggregated RAG results:');
      allRagResults.forEach((res: any, i: number) => {
        console.log(`  [${i+1}] ${res.title}\n  URL: ${res.url}\n  Score: ${res.score?.toFixed(3) || ''}\n  Content: ${res.content?.slice(0, 200) || ''}...`);
      });
    }

    // --- Strict prompt construction and fallback ---
    const requiredSelectors = allRagResults.filter((r: any) => /selector|workflow|playwright|approval|dubbed|checkbox|hover|order|spot/i.test(r.content));
    if (requiredSelectors.length < stepQueries.length) {
      console.log('\nNot enough information found in the knowledge base to generate a reliable test.');
      const { recordNow } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'recordNow',
          message: 'Would you like to record the workflow manually using Playwright recorder?',
          default: true
        }
      ]);
      if (recordNow) {
        await handleRecordCommand();
        return;
      } else {
        console.log('Please update the knowledge base or provide more details.');
        return;
      }
    }

    const ragResultsFull = (await semanticSearch(cardText, 50)).map((res: any) => ({
      title: res.title,
      url: res.url,
      content: res.content.slice(0, 500),
      score: res.score
    }));
    ragResultsFull.forEach((res, i) => {
      console.log(`  [${i+1}] ${res.title}\n  URL: ${res.url}\n  Score: ${res.score.toFixed(3)}\n  Content: ${res.content.slice(0, 300)}...`);
    });

    // Detect spot creation requirement from card
    const spotCreationDetected = /create (a )?spot|quick order|qo/i.test(cardText);
    let spotData = {
      adType: 'Radio Commercial',
      client: 'Dairy Queen - Taber',
      title: 'JS - PLAYWRIGHT TEST',
      isci: '1234',
      status: 'Needs Producing',
      length: '30',
      rotation: '100',
      station: 'CHBW-FM B94',
      contract: '12312322',
      spotRequiresApproval: true,
      cartId: '5252',
    };
    // Detect login requirement from card
    const loginDetected = /login|sign in|log in|authenticate|as [\w ]+/i.test(cardText);
    let loginCredentials = undefined;
    // Always use loginUsers.json if login is detected
    if (loginDetected) {
      let loginUsers = [];
      try {
        loginUsers = JSON.parse(fs.readFileSync(path.join(__dirname, '../knowledgebase/loginUsers.json'), 'utf8'));
      } catch {}
      const validUser = loginUsers.find((u: any) => u.isValid && u.email && u.password);
      if (validUser) {
        loginCredentials = { email: validUser.email, password: validUser.password };
      } else {
        console.warn('No valid login user found in loginUsers.json. Please update the file with a valid user.');
        loginCredentials = { email: 'imail-test+DemoProdDirector@vcreativeinc.com', password: 'OneVCTeam2023!' };
      }
    }

    // --- Prompt for source code context ---
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

    // --- Streamlined summary and instructions ---
    console.log('\n========= Playwright Test Generation Summary =========');
    console.log(`JIRA Ticket: ${jiraTicket}`);
    console.log(`Title: ${title}`);
    if (requiredEntities.length) {
      console.log(`Detected Entities: ${requiredEntities.join(', ')}`);
      if (useMockData) {
        console.log('Using mock data for entities.');
      } else {
        console.log('Using provided data for entities.');
      }
    } else {
      console.log('No specific entities detected.');
    }
    if (spotCreationDetected) {
      console.log('Spot creation workflow will be included.');
    }
    if (loginDetected && loginCredentials) {
      console.log(`Login workflow will use: ${loginCredentials.email}`);
    }
    console.log(`Environment: ${testDomain}`);
    console.log('Top RAG results:');
    allRagResults.forEach((res: any, i: number) => {
      console.log(`  [${i+1}] ${res.title}`);
    });
    console.log('====================================================\n');

    // Prompt for test file path and write mode before generating the test
    const { testFilePath, mode } = await inquirer.prompt([
      {
        type: 'input',
        name: 'testFilePath',
        message: 'Path to save the Playwright test file:',
        default: 'playwright/test/test-1'
      },
      {
        type: 'list',
        name: 'mode',
        message: 'Write mode:',
        choices: [
          { name: 'Create new file', value: 'new' },
          { name: 'Append to existing file', value: 'append' }
        ],
        default: 'new'
      }
    ]);
    absPath = path.resolve(testFilePath);
    writeMode = mode;

    // Load loginUsers from knowledgebase and use a valid user
    let loginUsers = [];
    try {
      loginUsers = JSON.parse(fs.readFileSync(path.join(__dirname, '../knowledgebase/loginUsers.json'), 'utf8'));
    } catch {}
    if (loginDetected && loginUsers.length) {
      // Use the first valid user, and warn if none found
      const validUser = loginUsers.find((u: any) => u.isValid && u.email && u.password);
      if (validUser) {
        loginCredentials = { email: validUser.email, password: validUser.password };
      } else {
        console.warn('No valid login user found in loginUsers.json. Please update the file with a valid user.');
        loginCredentials = { email: 'imail-test+DemoProdDirector@vcreativeinc.com', password: 'OneVCTeam2023!' };
      }
    }
    // Warn if testDomain is missing
    if (!testDomain) {
      console.warn('No environment URL selected. Please select a valid environment.');
    }

    // Generate and write the test as before
    const testCode = await generatePlaywrightTest({
      jiraTitle: title,
      jiraDescription: description,
      acceptanceCriteria,
      ragResults: allRagResults,
      requiredEntities,
      mockData,
      sourceContext,
      testDomain,
      loginCredentials,
      spotData
    });
    console.log('\nGenerated Playwright Test:\n');
    console.log(testCode);
    // Before writing the test, scan and replace login/spot creation blocks
    let finalTestCode = testCode;
    const canonicalLogin = require('../knowledgebase/playwrightSnippets.json').login.snippet.map((s: string) =>
      s.replace('<ENV_URL>', testDomain)
       .replace('<USER_EMAIL>', loginCredentials?.email || '')
       .replace('<USER_PASSWORD>', loginCredentials?.password || '')
    ).join('\n');
    const canonicalSpot = require('../knowledgebase/playwrightSnippets.json').spotCreation.snippet.map((s: string) =>
      s.replace('${spotData.adType}', spotData?.adType || '')
       .replace('spotData.client', spotData?.client || '')
       .replace('spotData.title', spotData?.title || '')
       .replace('spotData.isci', spotData?.isci || '')
       .replace('spotData.length', spotData?.length || '')
       .replace('spotData.rotation', spotData?.rotation || '')
       .replace('spotData.contract', spotData?.contract || '')
       .replace('spotData.filePath', 'valid_file_1.mp4')
    ).join('\n');
    // Replace login block
    finalTestCode = finalTestCode.replace(/\/\/ Canonical Login Workflow[\s\S]*?await expect\(page\.locator\('\.vcreative-icon'\)\)\.toBeVisible\(\);/, `// Canonical Login Workflow\n${canonicalLogin}`);
    // Replace spot creation block
    finalTestCode = finalTestCode.replace(/\/\/ Canonical Spot Creation Workflow[\s\S]*?await page\.click\("button:has-text\('Save Spot'\)"\);/, `// Canonical Spot Creation Workflow\n${canonicalSpot}`);
    // Confirm with developer
    console.log('\n=== CREDENTIALS AND CANONICAL CODE TO BE USED ===');
    console.log('Login Email:', loginCredentials?.email);
    console.log('Login Password:', loginCredentials?.password);
    console.log('\nCanonical Login Code:\n', canonicalLogin);
    console.log('\nCanonical Spot Creation Code:\n', canonicalSpot);
    const { confirmWrite } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmWrite',
        message: 'Do you confirm these credentials and canonical code will be used in the test?',
        default: true
      }
    ]);
    if (!confirmWrite) {
      console.log('Test file not written. Please update credentials or code and retry.');
      return;
    }
    // Write the test file
    if (writeMode === 'new') {
      fs.writeFileSync(absPath, finalTestCode, 'utf8');
      console.log(`\nTest file created: ${absPath}`);
    } else {
      const testBlockMatch = finalTestCode.match(/(test\s*\(.*[\s\S]*)/);
      if (testBlockMatch) {
        fs.appendFileSync(absPath, '\n' + testBlockMatch[1], 'utf8');
        console.log(`\nTest block appended to: ${absPath}`);
      } else {
        console.error('Could not find a test() block to append.');
      }
    }

    // Automatically run the test after creation
    try {
      console.log(`\nRunning: PWDEBUG=1 npx playwright test ${absPath}\n`);
      execSync(`PWDEBUG=1 npx playwright test ${absPath}`, { stdio: 'inherit' });
    } catch (err) {
      if (err instanceof Error) {
        console.error('Error running the test:', err.message);
      } else {
        console.error('Error running the test:', err);
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

export async function handleRecordCommand() {
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

  // Prompt for test file path and write mode
  const { testFilePath, mode } = await inquirer.prompt([
    {
      type: 'input',
      name: 'testFilePath',
      message: 'Path to save the Playwright test file:',
      default: 'playwright/test/test-1'
    },
    {
      type: 'list',
      name: 'mode',
      message: 'Write mode:',
      choices: [
        { name: 'Create new file', value: 'new' },
        { name: 'Append to existing file', value: 'append' }
      ],
      default: 'new'
    }
  ]);
  absPath = path.resolve(testFilePath);
  writeMode = mode;

  await recordPlaywrightTest(url, absPath);

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
      console.log(`\nRunning: PWDEBUG=1 npx playwright test ${absPath}\n`);
      execSync(`PWDEBUG=1 npx playwright test ${absPath}`, { stdio: 'inherit' });
    } catch (err) {
      if (err instanceof Error) {
        console.error('Error running the test:', err.message);
      } else {
        console.error('Error running the test:', err);
      }
    }
  }
}
