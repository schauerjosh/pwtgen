import { config } from './config';
import inquirer from 'inquirer';
import { fetchJiraIssue } from './jira';
import { generatePlaywrightTest } from './openai';
import fs from 'fs';
import path from 'path';

export default async function main() {
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

    // Generate Playwright test using OpenAI
    console.log('\nGenerating Playwright test using OpenAI...');
    const testCode = await generatePlaywrightTest({
      title,
      description,
      acceptanceCriteria
    });
    console.log('\nGenerated Playwright Test:\n');
    console.log(testCode);

    // Prompt for file path
    const defaultPath = path.join('tests', `${jiraTicket}.spec.ts`);
    const { testPath } = await inquirer.prompt([
      {
        type: 'input',
        name: 'testPath',
        message: 'Path to save the test file:',
        default: defaultPath,
        validate: (input) => input ? true : 'Test file path is required.'
      }
    ]);
    const absPath = path.resolve(testPath);
    let writeMode: 'new' | 'append' = 'new';
    if (fs.existsSync(absPath)) {
      const { append } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'append',
          message: `File ${testPath} exists. Append to it? (No will overwrite)`,
          default: true
        }
      ]);
      writeMode = append ? 'append' : 'new';
    }
    // Ensure directory exists
    fs.mkdirSync(path.dirname(absPath), { recursive: true });
    if (writeMode === 'new') {
      // Write full test file
      fs.writeFileSync(absPath, testCode, 'utf8');
      console.log(`\nTest file created: ${absPath}`);
    } else {
      // Append only the test() block
      const testBlockMatch = testCode.match(/(test\s*\(.*[\s\S]*)/);
      if (testBlockMatch) {
        fs.appendFileSync(absPath, '\n' + testBlockMatch[1], 'utf8');
        console.log(`\nTest block appended to: ${absPath}`);
      } else {
        console.error('Could not find a test() block to append.');
      }
    }
  } catch (err: any) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}
