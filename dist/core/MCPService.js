import { NaturalLanguageProcessor } from './NaturalLanguageProcessor';
export class MCPService {
    nlp;
    constructor() {
        this.nlp = new NaturalLanguageProcessor();
    }
    async generateTestFromTicket(request, onIntervention) {
        // Simulate fetching ticket details (in real implementation, this would call your ticket system API)
        const ticketDetails = await this.fetchTicketDetails(request.ticket);
        // Convert ticket to natural language request
        const nlRequest = {
            testName: `${request.ticket} - ${ticketDetails.title}`,
            description: ticketDetails.description,
            url: this.getEnvironmentUrl(request.env),
            ticket: request.ticket,
            environment: request.env,
            env: request.env,
            outputPath: request.outputPath
        };
        // Pass only the fields required by NaturalLanguageTestRequest
        return await this.nlp.processTicketRequest(nlRequest, onIntervention);
    }
    async fetchTicketDetails(ticket) {
        // Mock ticket details - replace with actual API call to your ticket system
        return {
            title: 'Job Completion Flow Test',
            description: `Test the job completion workflow for ticket ${ticket}`,
            acceptanceCriteria: [
                'User can navigate to job completion page',
                'User can mark job as complete',
                'System shows completion confirmation',
                'Job status updates correctly'
            ]
        };
    }
    getEnvironmentUrl(env) {
        const envUrls = {
            'test': 'https://dev.yourapp.com',
            'staging': 'https://staging.yourapp.com',
            'prod': 'https://yourapp.com'
        };
        return envUrls[env] || envUrls['test'];
    }
}
//# sourceMappingURL=MCPService.js.map