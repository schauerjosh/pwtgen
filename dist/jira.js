"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchJiraIssue = fetchJiraIssue;
const axios_1 = __importDefault(require("axios"));
const config_1 = require("./config");
async function fetchJiraIssue(issueKey) {
    const url = `https://${config_1.config.jiraDomain}/rest/api/3/issue/${issueKey}`;
    const auth = Buffer.from(`${config_1.config.jiraEmail}:${config_1.config.jiraApiToken}`).toString('base64');
    try {
        const response = await axios_1.default.get(url, {
            headers: {
                'Authorization': `Basic ${auth}`,
                'Accept': 'application/json',
            },
        });
        return response.data;
    }
    catch (error) {
        if (error.response && error.response.status === 404) {
            throw new Error('Jira ticket not found.');
        }
        if (error.response && error.response.status === 401) {
            throw new Error('Jira authentication failed.');
        }
        throw new Error('Failed to fetch Jira ticket: ' + error.message);
    }
}
