// src/jira/JiraClient.ts
import axios from 'axios';
import { JiraTicketSchema } from '../types/index.js';
import { logger } from '../utils/logger.js';
export class JiraClient {
    client;
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
    async testConnection() {
        try {
            await this.client.get('/myself');
            logger.info('Jira connection successful');
        }
        catch (error) {
            logger.error('Jira connection failed:', error);
            throw new Error('Failed to connect to Jira. Please check your credentials.');
        }
    }
    async getTicket(ticketKey) {
        try {
            logger.info(`Fetching Jira ticket: ${ticketKey}`);
            const response = await this.client.get(`/issue/${ticketKey}`, {
                params: {
                    fields: 'summary,description,assignee,status,priority,customfield_10000',
                },
            });
            const issue = response.data;
            const acceptanceCriteria = this.extractAcceptanceCriteria(issue.fields.description?.content || issue.fields.description || '', issue.fields.customfield_10000);
            const ticket = {
                key: issue.key,
                summary: issue.fields.summary,
                description: this.extractPlainText(issue.fields.description),
                acceptanceCriteria,
                assignee: issue.fields.assignee?.displayName,
                status: issue.fields.status?.name,
                priority: issue.fields.priority?.name,
            };
            return JiraTicketSchema.parse(ticket);
        }
        catch (error) {
            logger.error(`Failed to fetch ticket ${ticketKey}:`, error);
            throw new Error(`Failed to fetch Jira ticket: ${ticketKey}`);
        }
    }
    extractPlainText(content) {
        if (typeof content === 'string') {
            return content;
        }
        if (content?.content) {
            return this.extractTextFromADF(content.content);
        }
        return '';
    }
    extractTextFromADF(content) {
        let text = '';
        for (const node of content) {
            if (node.type === 'text') {
                text += node.text;
            }
            else if (node.type === 'paragraph' && node.content) {
                text += this.extractTextFromADF(node.content) + '\n';
            }
            else if (node.type === 'listItem' && node.content) {
                text += '• ' + this.extractTextFromADF(node.content) + '\n';
            }
            else if (node.content) {
                text += this.extractTextFromADF(node.content);
            }
        }
        return text.trim();
    }
    extractAcceptanceCriteria(description, customField) {
        const criteria = [];
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
    parseAcceptanceCriteria(text) {
        const criteria = [];
        if (!text || typeof text !== 'string')
            return criteria;
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
                    }
                    else if (typeof match === 'string') {
                        // Fallback: push the match itself if no group
                        criteria.push(match.trim());
                    }
                }
            }
        }
        return criteria;
    }
}
//# sourceMappingURL=JiraClient.js.map