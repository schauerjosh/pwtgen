import chalk from 'chalk';

export const logger = {
  info: (...args: any[]) => console.log(chalk.blue('[INFO]'), ...args),
  warn: (...args: any[]) => console.warn(chalk.yellow('[WARN]'), ...args),
  error: (...args: any[]) => console.error(chalk.red('[ERROR]'), ...args),
  success: (...args: any[]) => console.log(chalk.green('[SUCCESS]'), ...args),
};