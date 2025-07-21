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

  private extractPlainText(content: unknown): string {
    if (typeof content === 'string') {
      return content;
    }
    if (typeof content === 'object' && content && (content as Record<string, unknown>)['content']) {
      return this.extractTextFromADF((content as { content: unknown[] }).content);
    }
    return '';
  }

  private extractTextFromADF(content: unknown[]): string {
    let text = '';
    for (const node of content) {
      if (typeof node === 'object' && node !== null) {
        const n = node as Record<string, unknown>;
        if (n['type'] === 'text' && typeof n['text'] === 'string') {
          text += n['text'];
        } else if (n['type'] === 'paragraph' && Array.isArray(n['content'])) {
          text += this.extractTextFromADF(n['content'] as unknown[]) + '\n';
        } else if (n['type'] === 'listItem' && Array.isArray(n['content'])) {
          text += '\u2022 ' + this.extractTextFromADF(n['content'] as unknown[]) + '\n';
        } else if (Array.isArray(n['content'])) {
          text += this.extractTextFromADF(n['content'] as unknown[]);
        }
      }
    }
    return text.trim();
  }

  private extractAcceptanceCriteria(description: string, customField?: unknown): string[] {
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
    if (!text || typeof text !== 'string') return criteria;

    const patterns = [
      /(?:Given|When|Then|And|But)\s+(.+?)(?=\n|$)/gi,
      /(?:Verify|Check|Ensure|Confirm)\s+(.+?)(?=\n|$)/gi,
      /^\s*[-•*]\s+(.+?)(?=\n|$)/gm,
      /^\s*\d+\.\s+(.+?)(?=\n|$)/gm,
    ];

    for (const pattern of patterns) {
      // Use match instead of matchAll for compatibility
      const matches = text.match(pattern);
      if (matches) {
        for (const match of matches) {
          // Extract the actual criteria text using the pattern
          const groupMatch = pattern.exec(match);
          if (groupMatch && groupMatch[1]?.trim()) {
            criteria.push(groupMatch[1].trim());
          } else if (typeof match === 'string') {
            // Fallback: push the match itself if no group
            criteria.push(match.trim());
          }
        }
      }
    }

    return criteria;
  }
}
