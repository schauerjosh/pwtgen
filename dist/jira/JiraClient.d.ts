import { JiraTicket } from '../types/index.js';
export declare class JiraClient {
    private client;
    constructor();
    testConnection(): Promise<void>;
    getTicket(ticketKey: string): Promise<JiraTicket>;
    private extractPlainText;
    private extractTextFromADF;
    private extractAcceptanceCriteria;
    private parseAcceptanceCriteria;
}
//# sourceMappingURL=JiraClient.d.ts.map