/**
 * @file File & directory reading tools
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { BaseTool, ToolExecutionContext, ToolResult, ToolSchema } from './base.js';
import { SafetyGuard } from '../safety/guard.js';

export class ReadFileTool extends BaseTool {
  readonly schema: ToolSchema = {
    name: 'read_file',
    description: 'Reads the contents of a file within the workspace. Supports start_line and end_line slicing with 1-based indexing.',
    parameters: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: 'The relative path to the file'
        },
        start_line: {
          type: 'number',
          description: 'Optional 1-based line number to start reading from'
        },
        end_line: {
          type: 'number',
          description: 'Optional 1-based line number to end reading at (inclusive)'
        }
      },
      required: ['file_path']
    }
  };

  async execute(
    args: { file_path: string; start_line?: number; end_line?: number },
    context: ToolExecutionContext
  ): Promise<ToolResult> {
    const { file_path, start_line, end_line } = args;
    const guard = new SafetyGuard(context.workspaceRoot);

    const pathCheck = guard.validatePath(file_path);
    if (!pathCheck.allowed) {
      return { success: false, output: '', error: pathCheck.reason };
    }

    const absPath = path.resolve(context.workspaceRoot, file_path);

    try {
      const content = await fs.readFile(absPath, 'utf-8');
      const allLines = content.split('\n');

      let start = Math.max(1, start_line ?? 1);
      let end = Math.min(allLines.length, end_line ?? allLines.length);

      if (start > end) {
        return {
          success: false,
          output: '',
          error: `Invalid range: start_line (${start}) is greater than end_line (${end})`
        };
      }

      const selectedLines = allLines.slice(start - 1, end);
      const formatted = selectedLines
        .map((line, idx) => `${(start + idx).toString().padStart(4, ' ')}: ${line}`)
        .join('\n');

      return {
        success: true,
        output: `File: ${file_path} (Lines ${start}-${end} of ${allLines.length})\n\n${formatted}`,
        metadata: {
          totalLines: allLines.length,
          returnedLines: selectedLines.length
        }
      };
    } catch (err: any) {
      return {
        success: false,
        output: '',
        error: `Could not read file "${file_path}": ${err.message}`
      };
    }
  }
}

export class ListDirectoryTool extends BaseTool {
  readonly schema: ToolSchema = {
    name: 'list_dir',
    description: 'Lists the directory contents within the workspace, showing files and subfolders.',
    parameters: {
      type: 'object',
      properties: {
        dir_path: {
          type: 'string',
          description: 'Relative path of directory to list (default "." for workspace root)'
        }
      },
      required: []
    }
  };

  async execute(
    args: { dir_path?: string },
    context: ToolExecutionContext
  ): Promise<ToolResult> {
    const dir_path = args.dir_path || '.';
    const guard = new SafetyGuard(context.workspaceRoot);

    const pathCheck = guard.validatePath(dir_path);
    if (!pathCheck.allowed) {
      return { success: false, output: '', error: pathCheck.reason };
    }

    const absPath = path.resolve(context.workspaceRoot, dir_path);

    try {
      const entries = await fs.readdir(absPath, { withFileTypes: true });
      const files: string[] = [];
      const dirs: string[] = [];

      for (const entry of entries) {
        if (entry.name.startsWith('.') && entry.name !== '.agentrules') continue;
        if (entry.name === 'node_modules' || entry.name === 'dist') continue;

        if (entry.isDirectory()) {
          dirs.push(`${entry.name}/`);
        } else {
          files.push(entry.name);
        }
      }

      dirs.sort();
      files.sort();

      const output = [
        `Directory: ${dir_path}`,
        ...dirs.map((d) => `  [DIR]  ${d}`),
        ...files.map((f) => `  [FILE] ${f}`)
      ].join('\n');

      return {
        success: true,
        output
      };
    } catch (err: any) {
      return {
        success: false,
        output: '',
        error: `Could not list directory "${dir_path}": ${err.message}`
      };
    }
  }
}
