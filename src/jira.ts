import axios from 'axios';
import { config } from './config';

export interface JiraIssueFields {
  summary: string;
  description?: { content: any[] } | string;
  customfield_10031?: any; // Acceptance Criteria (custom field, may vary)
}

export interface JiraIssue {
  key: string;
  fields: JiraIssueFields;
}

export async function fetchJiraIssue(issueKey: string): Promise<JiraIssue> {
  const url = `https://${config.jiraDomain}/rest/api/3/issue/${issueKey}`;
  const auth = Buffer.from(`${config.jiraEmail}:${config.jiraApiToken}`).toString('base64');
  try {
    const response = await axios.get(url, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json',
      },
    });
    return response.data;
  } catch (error: any) {
    if (error.response && error.response.status === 404) {
      throw new Error('Jira ticket not found.');
    }
    if (error.response && error.response.status === 401) {
      throw new Error('Jira authentication failed.');
    }
    throw new Error('Failed to fetch Jira ticket: ' + error.message);
  }
}
