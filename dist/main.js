"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleFromJiraCommand = handleFromJiraCommand;
exports.handleRecordCommand = handleRecordCommand;
const config_1 = require("./config");
const child_process_1 = require("child_process");
const inquirer_1 = __importDefault(require("inquirer"));
const jira_1 = require("./jira");
const openai_1 = require("./openai");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const axios = require('axios');
const actions_json_1 = __importDefault(require("../knowledgebase/actions.json"));
const article_embeddings_json_1 = __importDefault(require("../knowledgebase/article_embeddings.json"));
const articles_json_1 = __importDefault(require("../knowledgebase/articles.json"));
const ENV_URLS = {
    prod: 'https://vcreative.net/',
    twotest: 'https://two-test.vcreative.net/',
    smoke: 'https://smoketest.vcreative.net/',
    qa: 'https://qa.vcreative.net/',
    local: 'http://localhost:4200',
};
// Ensure useMockData is defined
let useMockData = false;
function getActionSteps(actionName) {
    const found = actions_json_1.default.find((a) => a.action.toLowerCase().includes(actionName.toLowerCase()));
    return found ? found.steps : [];
}
async function getQueryEmbedding(query) {
    const openai = new (require('openai')).OpenAI({ apiKey: config_1.config.openaiApiKey });
    const response = await openai.embeddings.create({
        model: 'text-embedding-ada-002',
        input: query,
    });
    return response.data[0].embedding;
}
function cosineSimilarity(a, b) {
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
async function semanticSearch(query, topN = 3) {
    const queryEmbedding = await getQueryEmbedding(query);
    const scored = article_embeddings_json_1.default.map((item, idx) => ({
        idx,
        score: cosineSimilarity(queryEmbedding, item.embedding)
    }));
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topN).map(({ idx, score }) => ({
        ...articles_json_1.default[idx],
        score
    }));
}
// Ensure requiredEntities, mockData, absPath, writeMode are always defined
let requiredEntities = [];
let mockData = {};
let absPath = '';
let writeMode = 'new';
async function handleFromJiraCommand() {
    // Prompt for Jira ticket number only
    const { jiraTicket } = await inquirer_1.default.prompt([
        {
            type: 'input',
            name: 'jiraTicket',
            message: 'Enter the Jira ticket number:',
            validate: (input) => input ? true : 'Jira ticket number is required.'
        }
    ]);
    // Fetch Jira ticket data and return the title
    try {
        const issue = await (0, jira_1.fetchJiraIssue)(jiraTicket);
        const title = issue.fields.summary;
        let description = '';
        if (typeof issue.fields.description === 'string') {
            description = issue.fields.description;
        }
        else if (issue.fields.description && issue.fields.description.content) {
            description = issue.fields.description.content.map((c) => c.content?.map((cc) => cc.text).join(' ')).join(' ');
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
        const { env } = await inquirer_1.default.prompt([
            {
                type: 'list',
                name: 'env',
                message: 'Select the environment to run the Playwright test:',
                choices: ENV_OPTIONS
            }
        ]);
        // Fix type for env and testDomain
        const envKey = env;
        const testDomain = ENV_URLS[envKey];
        // --- Extract numbered steps from description ---
        let stepQueries = [];
        if (description) {
            // Match lines starting with a number and a dot (e.g., '1. Log in')
            const stepLines = description.split(/\n|\r/).filter(line => /^\d+\.\s+/.test(line));
            if (stepLines.length) {
                stepQueries = stepLines.map(line => line.replace(/^\d+\.\s+/, '').trim());
            }
        }
        // --- Query RAG for each step if numbered steps exist ---
        let stepRagResults = [];
        // Add verbose flag
        const { verbose } = await inquirer_1.default.prompt([
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
                    results.forEach((res, i) => {
                        console.log(`  [${i + 1}] ${res.title}\n  Score: ${res.score?.toFixed(3) || ''}\n  Content: ${res.content?.slice(0, 200) || ''}...`);
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
        const ragResults = (await semanticSearch(compositeQuery, 50)).map((res) => ({
            title: res.title,
            url: res.url,
            content: res.content.slice(0, 500),
            score: res.score
        }));
        // Merge and deduplicate RAG results
        const allRagResults = [...stepRagResults, ...ragResults].reduce((acc, curr) => {
            if (!acc.some((r) => r.title === curr.title))
                acc.push(curr);
            return acc;
        }, []);
        if (verbose) {
            console.log('\nTop aggregated RAG results:');
            allRagResults.forEach((res, i) => {
                console.log(`  [${i + 1}] ${res.title}\n  URL: ${res.url}\n  Score: ${res.score?.toFixed(3) || ''}\n  Content: ${res.content?.slice(0, 200) || ''}...`);
            });
        }
        // --- Strict prompt construction and fallback ---
        const requiredSelectors = allRagResults.filter((r) => /selector|workflow|playwright|approval|dubbed|checkbox|hover|order|spot/i.test(r.content));
        if (requiredSelectors.length < stepQueries.length) {
            console.log('\nNot enough information found in the knowledge base to generate a reliable test.');
            const { recordNow } = await inquirer_1.default.prompt([
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
            }
            else {
                console.log('Please update the knowledge base or provide more details.');
                return;
            }
        }
        const ragResultsFull = (await semanticSearch(cardText, 50)).map((res) => ({
            title: res.title,
            url: res.url,
            content: res.content.slice(0, 500),
            score: res.score
        }));
        ragResultsFull.forEach((res, i) => {
            console.log(`  [${i + 1}] ${res.title}\n  URL: ${res.url}\n  Score: ${res.score.toFixed(3)}\n  Content: ${res.content.slice(0, 300)}...`);
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
        if (loginDetected) {
            // Use provided valid user
            loginCredentials = {
                email: 'imail-test+DemoProdDirector@vcreativeinc.com',
                password: 'OneVCTeam2023!',
            };
        }
        // --- Prompt for source code context ---
        const { sourcePaths } = await inquirer_1.default.prompt([
            {
                type: 'input',
                name: 'sourcePaths',
                message: 'Enter relative paths to source code files/folders for UI selectors/components (comma-separated):',
                default: 'src/',
                filter: (input) => input.split(',').map((s) => s.trim()).filter(Boolean)
            }
        ]);
        let sourceContext = '';
        for (const relPath of sourcePaths) {
            try {
                const absPath = path_1.default.resolve(relPath);
                if (fs_1.default.existsSync(absPath)) {
                    if (fs_1.default.lstatSync(absPath).isDirectory()) {
                        const files = fs_1.default.readdirSync(absPath).filter(f => f.endsWith('.ts') || f.endsWith('.tsx') || f.endsWith('.js'));
                        for (const file of files) {
                            sourceContext += `\n// File: ${file}\n` + fs_1.default.readFileSync(path_1.default.join(absPath, file), 'utf8');
                        }
                    }
                    else {
                        sourceContext += `\n// File: ${relPath}\n` + fs_1.default.readFileSync(absPath, 'utf8');
                    }
                }
            }
            catch { }
        }
        // --- Streamlined summary and instructions ---
        console.log('\n========= Playwright Test Generation Summary =========');
        console.log(`JIRA Ticket: ${jiraTicket}`);
        console.log(`Title: ${title}`);
        if (requiredEntities.length) {
            console.log(`Detected Entities: ${requiredEntities.join(', ')}`);
            if (useMockData) {
                console.log('Using mock data for entities.');
            }
            else {
                console.log('Using provided data for entities.');
            }
        }
        else {
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
        allRagResults.forEach((res, i) => {
            console.log(`  [${i + 1}] ${res.title}`);
        });
        console.log('====================================================\n');
        console.log('Generating Playwright test using OpenAI...');
        const testCode = await (0, openai_1.generatePlaywrightTest)({
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
        if (writeMode === 'new') {
            // Write full test file
            fs_1.default.writeFileSync(absPath, testCode, 'utf8');
            console.log(`\nTest file created: ${absPath}`);
        }
        else {
            // Append only the test() block
            const testBlockMatch = testCode.match(/(test\s*\(.*[\s\S]*)/);
            if (testBlockMatch) {
                fs_1.default.appendFileSync(absPath, '\n' + testBlockMatch[1], 'utf8');
                console.log(`\nTest block appended to: ${absPath}`);
            }
            else {
                console.error('Could not find a test() block to append.');
            }
        }
    }
    catch (err) {
        console.error('Error:', err.message);
        process.exit(1);
    }
}
async function fetchJiraUrl(jiraNumber, jiraBaseUrl, jiraEmail, jiraToken) {
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
    }
    catch (error) {
        if (error instanceof Error) {
            console.error('Failed to fetch JIRA issue:', error.message);
        }
        else {
            console.error('Failed to fetch JIRA issue:', error);
        }
        return '';
    }
}
async function recordPlaywrightTest(url, testPath) {
    console.log(`\nA browser window will open to: ${url}`);
    console.log('Perform your test actions in the browser.');
    console.log('When you are done, CLOSE the browser window.');
    console.log('Your actions will be automatically captured and saved as a Playwright test.');
    console.log('You do NOT need to copy/paste anything.');
    console.log('The CLI will confirm the test file location after you finish.\n');
    return new Promise((resolve, reject) => {
        const cmd = url ? `npx playwright codegen ${url} --output ${testPath}` : `npx playwright codegen --output ${testPath}`;
        const child = (0, child_process_1.exec)(cmd, (error, stdout, stderr) => {
            if (error) {
                reject(error);
            }
            else {
                // Inject wait and assertion after page.goto in the generated test
                let testCode = fs_1.default.readFileSync(testPath, 'utf8');
                testCode = testCode.replace(/(await page\.goto\(['"].+?['"]\);?)/, `$1\n  await page.waitForLoadState('networkidle');\n  await expect(page).toHaveURL('${url}');`);
                fs_1.default.writeFileSync(testPath, testCode, 'utf8');
                console.log(`\n✅ Playwright test actions have been captured and saved to: ${testPath}`);
                console.log('You can now commit and push this file to your repo.');
                resolve(stdout);
            }
        });
        if (child.stdout)
            child.stdout.pipe(process.stdout);
        if (child.stderr)
            child.stderr.pipe(process.stderr);
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
    const { env } = await inquirer_1.default.prompt([
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
    const url = ENV_URLS[env];
    // Prompt for login credentials
    let loginCredentials = undefined;
    const { wantsLogin } = await inquirer_1.default.prompt([
        {
            type: 'confirm',
            name: 'wantsLogin',
            message: 'Do you want to provide login credentials (email/password)?',
            default: false,
        },
    ]);
    if (wantsLogin) {
        loginCredentials = await inquirer_1.default.prompt([
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
        const { saveFixture } = await inquirer_1.default.prompt([
            {
                type: 'confirm',
                name: 'saveFixture',
                message: 'Do you want to save these credentials as a fixture?',
                default: true,
            },
        ]);
        if (saveFixture) {
            const usersDir = path_1.default.join('playwright', 'fixtures', 'users');
            fs_1.default.mkdirSync(usersDir, { recursive: true });
            const usersFile = path_1.default.join(usersDir, 'users.json');
            let users = [];
            if (fs_1.default.existsSync(usersFile)) {
                try {
                    users = JSON.parse(fs_1.default.readFileSync(usersFile, 'utf8'));
                }
                catch { }
            }
            users.push(loginCredentials);
            fs_1.default.writeFileSync(usersFile, JSON.stringify(users, null, 2), 'utf8');
            console.log(`\n✅ Credentials saved to ${usersFile}`);
        }
    }
    // Prompt for spot data or mock files
    const { wantsSpotData } = await inquirer_1.default.prompt([
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
        const spotDetails = await inquirer_1.default.prompt([
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
        const spotsDir = path_1.default.join('playwright', 'fixtures', 'spots');
        fs_1.default.mkdirSync(spotsDir, { recursive: true });
        const spotsFile = path_1.default.join(spotsDir, 'spots.json');
        let spots = [];
        if (fs_1.default.existsSync(spotsFile)) {
            try {
                spots = JSON.parse(fs_1.default.readFileSync(spotsFile, 'utf8'));
            }
            catch { }
        }
        spots.push(spotDetails);
        fs_1.default.writeFileSync(spotsFile, JSON.stringify(spots, null, 2), 'utf8');
        console.log(`\n✅ Spot data saved to ${spotsFile}`);
    }
    else if (wantsSpotData === 'mock') {
        console.log('\nUsing mock spot data files.');
        // Optionally copy or reference mock files here
    }
    // Prompt for test file path and write mode
    const { testFilePath, mode } = await inquirer_1.default.prompt([
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
    absPath = path_1.default.resolve(testFilePath);
    writeMode = mode;
    await recordPlaywrightTest(url, absPath);
    // Prompt to run the test
    const { runTest } = await inquirer_1.default.prompt([
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
        }
        catch (err) {
            if (err instanceof Error) {
                console.error('Error running the test:', err.message);
            }
            else {
                console.error('Error running the test:', err);
            }
        }
    }
}
