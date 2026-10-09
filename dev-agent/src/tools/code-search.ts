/**
 * @file Fast regex/glob codebase search tool (ripgrep fallback)
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { BaseTool, ToolExecutionContext, ToolResult, ToolSchema } from './base.js';

export class CodeSearchTool extends BaseTool {
  readonly schema: ToolSchema = {
    name: 'search_code',
    description: 'Searches the workspace for regex or keyword occurrences across files, returning line numbers and matching snippets.',
    parameters: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: 'Regex pattern or search term'
        },
        file_extension: {
          type: 'string',
          description: 'Optional file extension filter (e.g., ".ts", ".tsx", ".py")'
        },
        max_results: {
          type: 'number',
          description: 'Maximum number of matches to return (default 25)'
        }
      },
      required: ['pattern']
    }
  };

  private async walk(dir: string, fileList: string[] = []): Promise<string[]> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await this.walk(fullPath, fileList);
      } else {
        fileList.push(fullPath);
      }
    }
    return fileList;
  }

  async execute(
    args: { pattern: string; file_extension?: string; max_results?: number },
    context: ToolExecutionContext
  ): Promise<ToolResult> {
    const { pattern, file_extension, max_results = 25 } = args;

    let regex: RegExp;
    try {
      regex = new RegExp(pattern, 'i');
    } catch {
      regex = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    }

    try {
      const allFiles = await this.walk(context.workspaceRoot);
      const results: string[] = [];
      let totalMatches = 0;

      for (const filePath of allFiles) {
        if (file_extension && !filePath.endsWith(file_extension)) continue;

        try {
          const content = await fs.readFile(filePath, 'utf-8');
          const lines = content.split('\n');
          const relPath = path.relative(context.workspaceRoot, filePath);

          lines.forEach((line, idx) => {
            if (regex.test(line) && totalMatches < max_results) {
              totalMatches++;
              results.push(`${relPath}:${idx + 1}: ${line.trim()}`);
            }
          });

          if (totalMatches >= max_results) break;
        } catch {
          // Skip unreadable files or binaries
        }
      }

      if (results.length === 0) {
        return {
          success: true,
          output: `No matches found for pattern "${pattern}".`
        };
      }

      return {
        success: true,
        output: `Found ${results.length} matches:\n\n` + results.join('\n'),
        metadata: { matchCount: results.length }
      };
    } catch (err: any) {
      return {
        success: false,
        output: '',
        error: `Search error: ${err.message}`
      };
    }
  }
}
