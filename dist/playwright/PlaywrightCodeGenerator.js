import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
export class PlaywrightCodeGenerator {
    enhanceGeneratedCode(code, config) {
        let enhanced = code;
        // Polyfill __dirname for ESM (works in both src and dist)
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = join(__filename, '..');
        // Always replace any process.env.TEST_EMAIL, TEST_PASSWORD, TEST_USERNAME in generated code
        const kbPath = join(__dirname, '../../knowledge-base/fixtures/test-users.md');
        let userFromKB = null;
        try {
            const file = readFileSync(kbPath, 'utf8');
            const match = file.match(/export const validUsers = (\[[\s\S]*?\]);/);
            if (match) {
                // eslint-disable-next-line no-eval
                const validUsers = eval(match[1]);
                let found = null;
                if (config.ticket && config.ticket.description) {
                    const desc = config.ticket.description.toLowerCase();
                    for (const user of validUsers) {
                        if (desc.includes(user.role.toLowerCase()) || desc.includes(user.email.split('@')[0].toLowerCase())) {
                            found = user;
                            break;
                        }
                    }
                }
                userFromKB = found ? found : validUsers[0];
            }
        }
        catch (e) {
            // fallback: leave as is
        }
        if (userFromKB) {
            // Replace all forms of process.env.TEST_EMAIL, TEST_PASSWORD, TEST_USERNAME
            enhanced = enhanced.replace(/process\.env\.(TEST_EMAIL|TEST_USERNAME)!?/g, `"${userFromKB.email}"`);
            enhanced = enhanced.replace(/process\.env\.TEST_PASSWORD!?/g, `"${userFromKB.password}"`);
        }
        return enhanced;
    }
}
//# sourceMappingURL=PlaywrightCodeGenerator.js.map