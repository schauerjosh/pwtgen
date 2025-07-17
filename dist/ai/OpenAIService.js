// src/ai/OpenAIService.ts
import OpenAI from 'openai';
import { logger } from '../utils/logger.js';
export class OpenAIService {
    client;
    constructor() {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            throw new Error('OPENAI_API_KEY environment variable is required');
        }
        this.client = new OpenAI({ apiKey });
    }
    async generateCode(prompt) {
        try {
            logger.info('Generating code with OpenAI...');
            const response = await this.client.chat.completions.create({
                model: 'gpt-4-turbo-preview',
                messages: [
                    {
                        role: 'system',
                        content: 'You are an expert Playwright test generator. Generate only clean, production-ready TypeScript code without explanations or markdown formatting.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.1,
                max_tokens: 4000,
                top_p: 0.9,
            });
            const generatedCode = response.choices[0]?.message?.content;
            if (!generatedCode) {
                throw new Error('No code generated from OpenAI response');
            }
            logger.info('Code generation completed');
            return this.cleanGeneratedCode(generatedCode);
        }
        catch (error) {
            logger.error('OpenAI code generation failed:', error);
            throw new Error(`Failed to generate code: ${error}`);
        }
    }
    cleanGeneratedCode(code) {
        let cleaned = code.replace(/```(?:typescript|ts|javascript|js)?\n?/g, '');
        cleaned = cleaned.replace(/```$/g, '');
        cleaned = cleaned.trim();
        // Always inject alphabetically sorted imports for Playwright
        if (!cleaned.includes("import { expect, test }")) {
            // Remove any existing unsorted import for test/expect
            cleaned = cleaned.replace(/import \{\s*test,\s*expect\s*\} from '@playwright\/test';?\n?/g, '');
            cleaned = cleaned.replace(/import \{\s*expect,\s*test\s*\} from '@playwright\/test';?\n?/g, '');
            cleaned = "import { expect, test } from '@playwright/test';\n\n" + cleaned;
        }
        return cleaned;
    }
}
//# sourceMappingURL=OpenAIService.js.map