/**
 * @file Terminal ANSI Renderer & Unified Diff Highlighter
 * Formats outputs for terminal display
 */

import chalk from 'chalk';

export class TerminalRenderer {
  /**
   * Renders the agent's internal thought/reasoning block
   */
  renderThought(thought: string): void {
    console.log(chalk.dim.italic(`\n💭 [Thinking] ${thought.trim()}`));
  }

  /**
   * Renders a tool invocation header
   */
  renderToolCall(toolName: string, args: Record<string, any>): void {
    const argsSummary = Object.entries(args)
      .map(([k, v]) => {
        const valStr = typeof v === 'string' ? (v.length > 50 ? `${v.slice(0, 47)}...` : v) : JSON.stringify(v);
        return `${chalk.cyan(k)}=${chalk.yellow(valStr)}`;
      })
      .join(', ');

    console.log(`\n${chalk.bold.blue('⚡ Tool Call:')} ${chalk.bold.magenta(toolName)}(${argsSummary})`);
  }

  /**
   * Renders unified diff with syntax colors
   */
  renderDiff(diffText: string): void {
    const lines = diffText.split('\n');
    const colored = lines.map((line) => {
      if (line.startsWith('+++') || line.startsWith('---')) {
        return chalk.bold.gray(line);
      }
      if (line.startsWith('@@')) {
        return chalk.cyan(line);
      }
      if (line.startsWith('+')) {
        return chalk.green(line);
      }
      if (line.startsWith('-')) {
        return chalk.red(line);
      }
      return chalk.dim(line);
    }).join('\n');

    console.log(`\n${chalk.bold('Diff Preview:')}\n${colored}`);
  }

  /**
   * Renders tool observation result
   */
  renderObservation(toolName: string, success: boolean, output: string): void {
    const statusTag = success ? chalk.bgGreen.black(' SUCCESS ') : chalk.bgRed.white(' ERROR ');
    console.log(`\n${statusTag} ${chalk.dim(`[${toolName} Observation]`)}`);
    console.log(chalk.gray(output.trim()));
  }

  /**
   * Renders context budget usage status
   */
  renderTokenMeter(currentTokens: number, maxTokens: number): void {
    const ratio = currentTokens / maxTokens;
    const percent = (ratio * 100).toFixed(1);
    let color = chalk.green;
    if (ratio > 0.8) color = chalk.red;
    else if (ratio > 0.6) color = chalk.yellow;

    console.log(chalk.dim(`\n📊 Context Budget: ${color(`${currentTokens.toLocaleString()} / ${maxTokens.toLocaleString()} tokens (${percent}%)`)}`));
  }

  /**
   * Renders error message
   */
  renderError(msg: string): void {
    console.error(`\n${chalk.bold.red('✖ Error:')} ${msg}`);
  }

  /**
   * Renders final assistant answer
   */
  renderAssistantMessage(content: string): void {
    console.log(`\n${chalk.bold.green('🤖 DevAgent:')}\n${content}\n`);
  }
}
