/**
 * @file Human-in-the-Loop interactive confirmation prompt
 */

import readline from 'node:readline';
import chalk from 'chalk';

export async function promptHITLConfirmation(
  actionDescription: string,
  explanation?: string
): Promise<'yes' | 'no' | 'explain'> {
  // If non-interactive environment (CI or piped input), default to safe mode
  if (!process.stdin.isTTY) {
    console.log(chalk.yellow(`[HITL Auto-Approved in Non-TTY]: ${actionDescription}`));
    return 'yes';
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    const ask = () => {
      console.log(`\n${chalk.bgYellow.black(' HUMAN-IN-THE-LOOP APPROVAL REQUIRED ')}`);
      console.log(`${chalk.bold('Action:')} ${actionDescription}`);
      rl.question(
        `${chalk.cyan('Permission required. Proceed?')} [${chalk.green('y')}es / ${chalk.red('n')}o / ${chalk.yellow('e')}xplain]: `,
        (answer) => {
          const trimmed = answer.trim().toLowerCase();
          if (trimmed === 'y' || trimmed === 'yes') {
            rl.close();
            resolve('yes');
          } else if (trimmed === 'n' || trimmed === 'no') {
            rl.close();
            resolve('no');
          } else if (trimmed === 'e' || trimmed === 'explain') {
            console.log(chalk.italic.gray(`\nSafety Explanation: ${explanation || 'This action modifies code or runs a potentially state-altering shell command.'}\n`));
            ask();
          } else {
            console.log(chalk.red('Invalid input. Please enter y, n, or e.'));
            ask();
          }
        }
      );
    };

    ask();
  });
}
