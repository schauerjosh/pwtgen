// src/utils/CodeFormatter.ts
import prettier from 'prettier';
import { logger } from './logger.js';
export class CodeFormatter {
    async format(code) {
        try {
            return await prettier.format(code, { parser: 'typescript' });
        }
        catch (error) {
            logger.warn('Prettier failed, returning unformatted code:', error);
            return code;
        }
    }
}
//# sourceMappingURL=CodeFormatter.js.map