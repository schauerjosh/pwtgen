// If the file is actually named 'enhancedIndex.ts' (not 'enhanced-index.ts'), update the import path accordingly.
// Otherwise, create the file '../types/enhanced-index.ts' and export the required types.

import { TicketTestRequest, DeveloperInterventionStep, NaturalLanguageTestResult } from "../types/enhanced-index.js";

export class NaturalLanguageProcessor {
  async processTicketRequest(
    request: TicketTestRequest & { description: string; url: string; environment: string; testName: string },
    onIntervention?: (step: DeveloperInterventionStep) => Promise<string>
  ): Promise<NaturalLanguageTestResult> {
    
    // Generate test steps based on ticket (this would be more sophisticated in real implementation)
    const steps: Array<{ description: string; code: string; developerModified?: boolean }> = [
      { 
        description: `Navigate to ${request.environment} environment`, 
        code: `await page.goto('${request.url}');` 
      },
      { 
        description: 'Wait for page to load', 
        code: `await page.waitForLoadState('networkidle');` 
      },
      { 
        description: 'Navigate to job completion section', 
        code: `await page.click('[data-testid="job-completion"]');` 
      },
      { 
        description: 'Verify job completion form is visible', 
        code: `await expect(page.locator('[data-testid="completion-form"]')).toBeVisible();` 
      },
      { 
        description: 'Fill job completion details', 
        code: `await page.fill('[data-testid="completion-notes"]', 'Job completed successfully');` 
      },
      { 
        description: 'Submit job completion', 
        code: `await page.click('[data-testid="submit-completion"]');` 
      },
      { 
        description: 'Verify completion confirmation', 
        code: `await expect(page.locator('[data-testid="completion-success"]')).toBeVisible();` 
      }
    ];

    // Process each step with potential developer intervention
    if (onIntervention) {
      for (let i = 0; i < steps.length; i++) {
        const suggestion = await onIntervention({
          stepIndex: i,
          description: steps[i].description,
          suggestedCode: steps[i].code,
          context: {
            ticket: request.ticket,
            environment: request.environment,
            currentStep: i + 1,
            totalSteps: steps.length
          }
        });
        
        if (suggestion && suggestion.trim() !== '') {
          steps[i].code = suggestion;
          // Mark as developer-modified for tracking
          steps[i].developerModified = true;
        }
      }
    }

    const generatedCode = this.generatePlaywrightTest(request, steps);

    return {
      testName: request.testName,
      code: generatedCode,
      steps: steps.map(s => s.description),
      ticket: request.ticket,
      environment: request.environment
    };
  }

  private generatePlaywrightTest(
    request: TicketTestRequest & { description: string; url: string; environment: string; testName: string },
    steps: Array<{ description: string; code: string; developerModified?: boolean }>
  ): string {
    const imports = `import { test, expect } from '@playwright/test';`;
    
    const testHeader = `
test.describe('${request.ticket} - Job Completion Tests', () => {
  test('${request.testName}', async ({ page }) => {`;

    const testSteps = steps.map((step, index) => {
      const comment = `    // Step ${index + 1}: ${step.description}`;
      const code = `    ${step.code}`;
      const modified = step.developerModified ? `    // ✏️ Developer modified` : '';
      return [comment, modified, code].filter(Boolean).join('\n');
    }).join('\n\n');

    const testFooter = `  });
});`;

    return [imports, testHeader, testSteps, testFooter].join('\n');
  }
}