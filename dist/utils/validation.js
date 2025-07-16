import { z } from 'zod';
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
export function validateConfig(config) {
    const result = TestConfigSchema.safeParse(config);
    if (!result.success) {
        throw new Error('Invalid test config: ' + JSON.stringify(result.error.format(), null, 2));
    }
    return config;
}
//# sourceMappingURL=validation.js.map