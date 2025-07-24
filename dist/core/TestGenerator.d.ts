import type { TestConfig, GeneratedTest } from '../types/index.js';
export declare class TestGenerator {
    private ragService;
    private openaiService;
    private codeGenerator;
    private formatter;
    constructor();
    /**
     * Optimize and clean up the final merged test code using OpenAI before saving.
     */
    private optimizeFinalCodeWithOpenAI;
    /**
     * Utility to determine if login should be prepended based on Jira card content.
     */
    private shouldPrependLogin;
    generate(config: TestConfig): Promise<GeneratedTest & {
        content: string;
    }>;
    private retrieveContext;
    private generateTestCode;
    private buildPrompt;
    private calculateConfidence;
    private extractTestName;
    private writeTestFile;
    private getUniqueFilePath;
}
export declare function getBaseUrl(env: string): string;
export declare const TestGeneratorUtils: {
    getBaseUrl: typeof getBaseUrl;
};
//# sourceMappingURL=TestGenerator.d.ts.map