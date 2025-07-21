import { TicketTestRequest, DeveloperInterventionStep, NaturalLanguageTestResult } from "../types/enhanced-index.js";
export declare class NaturalLanguageProcessor {
    processTicketRequest(request: TicketTestRequest & {
        description: string;
        url: string;
        environment: string;
        testName: string;
    }, onIntervention?: (step: DeveloperInterventionStep) => Promise<string>): Promise<NaturalLanguageTestResult>;
    private generatePlaywrightTest;
}
//# sourceMappingURL=NaturalLanguageProcessor.d.ts.map