import { NaturalLanguageTestRequest, NaturalLanguageTestResult } from '../types/enhanced-index';

export class TestGenerator {
  async generateFromNaturalLanguage(request: NaturalLanguageTestRequest): Promise<NaturalLanguageTestResult> {
    // For now, just delegate to the NaturalLanguageProcessor (could be extended)
    return {
      testName: request.testName,
      code: `// Generated test for: ${request.description}`,
      steps: [request.description]
    };
  }
}