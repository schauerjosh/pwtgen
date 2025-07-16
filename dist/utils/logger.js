import chalk from 'chalk';
export const logger = {
    info: (...args) => console.log(chalk.blue('[INFO]'), ...args),
    warn: (...args) => console.warn(chalk.yellow('[WARN]'), ...args),
    error: (...args) => console.error(chalk.red('[ERROR]'), ...args),
    success: (...args) => console.log(chalk.green('[SUCCESS]'), ...args),
};
//# sourceMappingURL=logger.js.map