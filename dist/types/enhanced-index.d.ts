export interface TicketTestRequest {
    ticket: string;
    env: string;
    outputPath: string;
}
export interface NaturalLanguageTestRequest {
    testName: string;
    description: string;
    url: string;
    ticket?: string;
    environment?: string;
}
export interface NaturalLanguageTestResult {
    testName: string;
    code: string;
    steps: string[];
    ticket?: string;
    environment?: string;
}
export interface DeveloperInterventionStep {
    stepIndex: number;
    description: string;
    suggestedCode: string;
    context?: {
        ticket: string;
        environment: string;
        currentStep: number;
        totalSteps: number;
    };
}
export interface SelfHealingResult {
    originalSelector: string;
    healedSelector: string;
    success: boolean;
    details?: string;
}
//# sourceMappingURL=enhanced-index.d.ts.map