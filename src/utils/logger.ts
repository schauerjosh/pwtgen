import chalk from 'chalk';

export const logger = {
  info: (...args: unknown[]) => console.log(chalk.blue('[INFO]'), ...args),
  warn: (...args: unknown[]) => console.warn(chalk.yellow('[WARN]'), ...args),
  error: (...args: unknown[]) => console.error(chalk.red('[ERROR]'), ...args),
  success: (...args: unknown[]) => console.log(chalk.green('[SUCCESS]'), ...args),
};