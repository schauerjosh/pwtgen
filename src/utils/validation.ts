import { z } from 'zod';
import type { TestConfig } from '../types/index';

const TestConfigSchema = z.object({
  ticket: z.object({
    key: z.string(),
    summary: z.string(),
    description: z.string(),
    acceptanceCriteria: z.array(z.string()).optional(),
  }),
  environment: z.string(),
  outputPath: z.string(),
  overwrite: z.boolean().optional(),
  dryRun: z.boolean().optional(),
  pageObjectPattern: z.boolean().optional(),
});

export function validateConfig(config: TestConfig): TestConfig {
  const result = TestConfigSchema.safeParse(config);
  if (!result.success) {
    throw new Error('Invalid test config: ' + JSON.stringify(result.error.format(), null, 2));
  }
  return config;
}