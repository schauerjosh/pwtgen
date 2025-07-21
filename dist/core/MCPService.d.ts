import { TicketTestRequest, NaturalLanguageTestResult, DeveloperInterventionStep } from '../types/enhanced-index.js';
export declare class MCPService {
    private nlp;
    constructor();
    generateTestFromTicket(request: TicketTestRequest, onIntervention?: (step: DeveloperInterventionStep) => Promise<string>): Promise<NaturalLanguageTestResult>;
    private fetchTicketDetails;
    private getEnvironmentUrl;
}
//# sourceMappingURL=MCPService.d.ts.map