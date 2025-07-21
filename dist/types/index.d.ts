export type Environment = 'dev' | 'qa' | 'staging' | 'prod';
export interface JiraTicket {
    key: string;
    summary: string;
    description: string;
    acceptanceCriteria?: string[];
    assignee?: string;
    status?: string;
    priority?: string;
}
export declare const JiraTicketSchema: {
    parse: (ticket: JiraTicket) => JiraTicket;
};
export interface TestConfig {
    ticket: JiraTicket;
    environment: Environment;
    outputPath: string;
    overwrite?: boolean;
    dryRun?: boolean;
    pageObjectPattern?: boolean;
    vCreativeCredentials?: {
        email: string;
        password: string;
    };
}
export interface RAGContext {
    id: string;
    content: string;
    type: 'selector' | 'workflow' | 'pattern' | 'fixture' | string;
    score: number;
    metadata?: Record<string, unknown>;
}
export interface GeneratedTest {
    filePath: string;
    testName: string;
    ticket: JiraTicket;
    environment: Environment;
    generatedAt: string;
    ragContexts: RAGContext[];
    confidence: number;
}
//# sourceMappingURL=index.d.ts.map