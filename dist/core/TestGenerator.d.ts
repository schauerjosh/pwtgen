import type { TestConfig, GeneratedTest } from '../types/index.js';
export declare class TestGenerator {
    private ragService;
    private openaiService;
    private codeGenerator;
    private formatter;
    constructor();
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