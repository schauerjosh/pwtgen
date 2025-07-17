import { TicketTestRequest, NaturalLanguageTestResult, DeveloperInterventionStep } from '../types/enhanced-index';
import { NaturalLanguageProcessor } from './NaturalLanguageProcessor';

export class MCPService {
  private nlp: NaturalLanguageProcessor;

  constructor() {
    this.nlp = new NaturalLanguageProcessor();
  }

  async generateTestFromTicket(
    request: TicketTestRequest,
    onIntervention?: (step: DeveloperInterventionStep) => Promise<string>
  ): Promise<NaturalLanguageTestResult> {
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
    return await this.nlp.processTicketRequest(nlRequest as any, onIntervention);
  }

  private async fetchTicketDetails(ticket: string) {
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

  private getEnvironmentUrl(env: string): string {
    const envUrls: Record<string, string> = {
      'test': 'https://dev.yourapp.com',
      'staging': 'https://staging.yourapp.com',
      'prod': 'https://yourapp.com'
    };
    return envUrls[env] || envUrls['test'];
  }
}