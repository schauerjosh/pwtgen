// src/jira/JiraClient.ts
import axios, { AxiosInstance } from 'axios';
import { JiraTicket, JiraTicketSchema } from '../types/index.js';
import { logger } from '../utils/logger.js';

export class JiraClient {
  private client: AxiosInstance;

  constructor() {
    const baseURL = process.env.JIRA_BASE_URL;
    const email = process.env.JIRA_EMAIL;
    const token = process.env.JIRA_API_TOKEN;

    if (!baseURL || !email || !token) {
      throw new Error('Missing Jira configuration. Please check your .env file.');
    }

    this.client = axios.create({
      baseURL: `${baseURL}/rest/api/3`,
      auth: {
        username: email,
        password: token,
      },
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });
  }

  async testConnection(): Promise<void> {
    try {
      await this.client.get('/myself');
      logger.info('Jira connection successful');
    } catch (error) {
      logger.error('Jira connection failed:', error);
      throw new Error('Failed to connect to Jira. Please check your credentials.');
    }
  }

  async getTicket(ticketKey: string): Promise<JiraTicket> {
    try {
      logger.info(`Fetching Jira ticket: ${ticketKey}`);

      const response = await this.client.get(`/issue/${ticketKey}`, {
        params: {
          fields: 'summary,description,assignee,status,priority,customfield_10000',
        },
      });

      const issue = response.data;

      const acceptanceCriteria = this.extractAcceptanceCriteria(
        issue.fields.description?.content || issue.fields.description || '',
        issue.fields.customfield_10000
      );

      const ticket: JiraTicket = {
        key: issue.key,
        summary: issue.fields.summary,
        description: this.extractPlainText(issue.fields.description),
        acceptanceCriteria,
        assignee: issue.fields.assignee?.displayName,
        status: issue.fields.status?.name,
        priority: issue.fields.priority?.name,
      };

      return JiraTicketSchema.parse(ticket);
    } catch (error) {
      logger.error(`Failed to fetch ticket ${ticketKey}:`, error);
      throw new Error(`Failed to fetch Jira ticket: ${ticketKey}`);
    }
  }

  private extractPlainText(content: any): string {
    if (typeof content === 'string') {
      return content;
    }

    if (content?.content) {
      return this.extractTextFromADF(content.content);
    }

    return '';
  }

  private extractTextFromADF(content: any[]): string {
    let text = '';

    for (const node of content) {
      if (node.type === 'text') {
        text += node.text;
      } else if (node.type === 'paragraph' && node.content) {
        text += this.extractTextFromADF(node.content) + '\n';
      } else if (node.type === 'listItem' && node.content) {
        text += '• ' + this.extractTextFromADF(node.content) + '\n';
      } else if (node.content) {
        text += this.extractTextFromADF(node.content);
      }
    }

    return text.trim();
  }

  private extractAcceptanceCriteria(description: string, customField?: any): string[] {
    const criteria: string[] = [];

    if (customField) {
      const customText = this.extractPlainText(customField);
      if (customText) {
        criteria.push(...this.parseAcceptanceCriteria(customText));
      }
    }

    const descriptionCriteria = this.parseAcceptanceCriteria(description);
    criteria.push(...descriptionCriteria);

    return [...new Set(criteria)];
  }

  private parseAcceptanceCriteria(text: string): string[] {
    const criteria: string[] = [];

    const patterns = [
      /(?:Given|When|Then|And|But)\s+(.+?)(?=\n|$)/gi,
      /(?:Verify|Check|Ensure|Confirm)\s+(.+?)(?=\n|$)/gi,
      /^\s*[-•*]\s+(.+?)(?=\n|$)/gm,
      /^\s*\d+\.\s+(.+?)(?=\n|$)/gm,
    ];

    for (const pattern of patterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        if (match[1]?.trim()) {
          criteria.push(match[1].trim());
        }
      }
    }

    return criteria;
  }
}
