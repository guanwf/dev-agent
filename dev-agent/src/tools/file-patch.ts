/**
 * @file Industrial-Grade Surgical File Patcher
 * Implements exact matching, whitespace-normalized matching, and Levenshtein sliding window fuzzy patching.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import * as diff from 'diff';
import { BaseTool, ToolExecutionContext, ToolResult, ToolSchema } from './base.js';
import { SafetyGuard } from '../safety/guard.js';

export interface PatchOptions {
  fuzzyThreshold?: number; // Minimum similarity ratio (0.0 - 1.0, default 0.80)
}

export interface MatchLocation {
  startLine: number; // 0-indexed
  endLine: number;   // 0-indexed, exclusive
  matchType: 'exact' | 'whitespace-normalized' | 'fuzzy-levenshtein';
  similarity: number;
}

/**
 * Calculates Levenshtein distance between two strings
 */
export function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  // Optimize space with two rows
  let prevRow = new Array(n + 1);
  let currRow = new Array(n + 1);

  for (let j = 0; j <= n; j++) prevRow[j] = j;

  for (let i = 1; i <= m; i++) {
    currRow[0] = i;
    const aChar = a[i - 1];
    for (let j = 1; j <= n; j++) {
      const cost = aChar === b[j - 1] ? 0 : 1;
      currRow[j] = Math.min(
        currRow[j - 1] + 1,      // insertion
        prevRow[j] + 1,          // deletion
        prevRow[j - 1] + cost    // substitution
      );
    }
    // Swap rows
    const temp = prevRow;
    prevRow = currRow;
    currRow = temp;
  }

  return prevRow[n];
}

/**
 * Calculates string similarity ratio (0.0 to 1.0)
 */
export function stringSimilarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1.0;
  const distance = levenshteinDistance(a, b);
  return 1.0 - distance / maxLen;
}

/**
 * Normalizes a line for whitespace-agnostic comparison
 */
function normalizeLine(line: string): string {
  return line.trim().replace(/\s+/g, ' ');
}

export class FilePatchTool extends BaseTool {
  readonly schema: ToolSchema = {
    name: 'patch_file',
    description: 'Surgically replaces a specific code block in a file without overwriting the entire file. Uses high-tolerance exact and fuzzy matching.',
    parameters: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: 'The relative path to the file to modify'
        },
        search_block: {
          type: 'string',
          description: 'The existing code snippet to locate and replace (include 2-3 lines of surrounding context)'
        },
        replace_block: {
          type: 'string',
          description: 'The new replacement code snippet'
        }
      },
      required: ['file_path', 'search_block', 'replace_block']
    },
    isDestructive: true
  };

  // In-memory atomic backup stack for quick rollbacks
  private backups: Map<string, Array<{ content: string; timestamp: number }>> = new Map();

  /**
   * Finds the best matching location in target file lines for search block
   */
  public findMatch(
    fileContent: string,
    searchBlock: string,
    fuzzyThreshold = 0.80
  ): MatchLocation | null {
    // Stage 1: Exact string match
    const exactIndex = fileContent.indexOf(searchBlock);
    if (exactIndex !== -1) {
      // Check if unique
      const secondIndex = fileContent.indexOf(searchBlock, exactIndex + 1);
      if (secondIndex !== -1) {
        throw new Error(
          'Ambiguous match: search_block appears multiple times in the file. Please provide more surrounding lines of context.'
        );
      }

      const before = fileContent.slice(0, exactIndex);
      const startLine = before.split('\n').length - 1;
      const searchLinesCount = searchBlock.split('\n').length;
      return {
        startLine,
        endLine: startLine + searchLinesCount,
        matchType: 'exact',
        similarity: 1.0
      };
    }

    const fileLines = fileContent.split('\n');
    const searchLines = searchBlock.split('\n');
    const searchLinesNorm = searchLines.map(normalizeLine);

    // Stage 2: Whitespace-Normalized Line Match
    const normalizedMatches: number[] = [];
    for (let i = 0; i <= fileLines.length - searchLines.length; i++) {
      let matches = true;
      for (let j = 0; j < searchLines.length; j++) {
        if (normalizeLine(fileLines[i + j]) !== searchLinesNorm[j]) {
          matches = false;
          break;
        }
      }
      if (matches) {
        normalizedMatches.push(i);
      }
    }

    if (normalizedMatches.length === 1) {
      const start = normalizedMatches[0];
      return {
        startLine: start,
        endLine: start + searchLines.length,
        matchType: 'whitespace-normalized',
        similarity: 0.95
      };
    } else if (normalizedMatches.length > 1) {
      throw new Error(
        'Ambiguous match: Normalized search_block matched multiple locations in file. Add more surrounding context lines.'
      );
    }

    // Stage 3: Levenshtein Sliding Window Fuzzy Match
    // Search with variable window sizes around searchLines.length (±1 line tolerance)
    let bestMatch: MatchLocation | null = null;
    let highestScore = 0;
    let secondHighestScore = 0;

    const windowSizes = [
      searchLines.length,
      Math.max(1, searchLines.length - 1),
      searchLines.length + 1
    ];

    const searchJoined = searchLinesNorm.join('\n');

    for (const wSize of windowSizes) {
      if (wSize > fileLines.length) continue;

      for (let i = 0; i <= fileLines.length - wSize; i++) {
        const candidateSlice = fileLines.slice(i, i + wSize);
        const candidateJoined = candidateSlice.map(normalizeLine).join('\n');

        const score = stringSimilarity(searchJoined, candidateJoined);

        if (score > highestScore) {
          secondHighestScore = highestScore;
          highestScore = score;
          bestMatch = {
            startLine: i,
            endLine: i + wSize,
            matchType: 'fuzzy-levenshtein',
            similarity: score
          };
        } else if (score > secondHighestScore) {
          secondHighestScore = score;
        }
      }
    }

    // Must exceed threshold and have significant margin over any rival ambiguous match
    if (highestScore >= fuzzyThreshold && (highestScore - secondHighestScore >= 0.08 || highestScore > 0.90)) {
      return bestMatch;
    }

    return null;
  }

  /**
   * Applies the patch in memory and returns new content and diff
   */
  public applyPatch(
    originalContent: string,
    filePath: string,
    searchBlock: string,
    replaceBlock: string,
    fuzzyThreshold = 0.80
  ): { patchedContent: string; diffText: string; match: MatchLocation } {
    const match = this.findMatch(originalContent, searchBlock, fuzzyThreshold);

    if (!match) {
      throw new Error(
        `Failed to locate search_block in "${filePath}". Neither exact, normalized, nor fuzzy Levenshtein match succeeded. Check lines or view file content.`
      );
    }

    const fileLines = originalContent.split('\n');
    const matchedOriginalLines = fileLines.slice(match.startLine, match.endLine);

    // Indentation Adaptation:
    // If original matched code had a specific base indent, adapt the replaceBlock lines accordingly
    const replaceLines = replaceBlock.split('\n');
    let adaptedReplaceLines = replaceLines;

    if (match.matchType !== 'exact' && matchedOriginalLines.length > 0) {
      const origIndentMatch = matchedOriginalLines[0].match(/^([ \t]*)/);
      const searchIndentMatch = searchBlock.split('\n')[0].match(/^([ \t]*)/);
      const origIndent = origIndentMatch ? origIndentMatch[1] : '';
      const searchIndent = searchIndentMatch ? searchIndentMatch[1] : '';

      if (origIndent !== searchIndent) {
        // Adjust indentation for each replace line
        adaptedReplaceLines = replaceLines.map((line) => {
          if (line.startsWith(searchIndent)) {
            return origIndent + line.slice(searchIndent.length);
          }
          return line;
        });
      }
    }

    const patchedLines = [
      ...fileLines.slice(0, match.startLine),
      ...adaptedReplaceLines,
      ...fileLines.slice(match.endLine)
    ];

    const patchedContent = patchedLines.join('\n');

    // Generate unified diff
    const diffText = diff.createTwoFilesPatch(
      filePath,
      filePath,
      originalContent,
      patchedContent,
      'original',
      'patched'
    );

    return {
      patchedContent,
      diffText,
      match
    };
  }

  /**
   * Reverts the latest backup for a file
   */
  public async rollback(filePath: string, workspaceRoot: string): Promise<boolean> {
    const absPath = path.resolve(workspaceRoot, filePath);
    const history = this.backups.get(absPath);
    if (!history || history.length === 0) {
      return false;
    }
    const last = history.pop()!;
    await fs.writeFile(absPath, last.content, 'utf-8');
    return true;
  }

  async execute(
    args: { file_path: string; search_block: string; replace_block: string },
    context: ToolExecutionContext
  ): Promise<ToolResult> {
    const { file_path, search_block, replace_block } = args;
    const guard = new SafetyGuard(context.workspaceRoot);

    const pathCheck = guard.validatePath(file_path);
    if (!pathCheck.allowed) {
      return { success: false, output: '', error: pathCheck.reason };
    }

    const absPath = path.resolve(context.workspaceRoot, file_path);

    let originalContent: string;
    try {
      originalContent = await fs.readFile(absPath, 'utf-8');
    } catch (err: any) {
      return {
        success: false,
        output: '',
        error: `Could not read target file "${file_path}": ${err.message}`
      };
    }

    // HITL confirmation for file modification if handler provided
    if (context.confirmAction) {
      const decision = await context.confirmAction(
        `Patch file "${file_path}"`,
        { filePath: file_path, searchLength: search_block.length, replaceLength: replace_block.length }
      );
      if (decision === 'no') {
        return { success: false, output: 'User rejected the file patch action.', error: 'Operation cancelled by user' };
      }
    }

    try {
      const { patchedContent, diffText, match } = this.applyPatch(
        originalContent,
        file_path,
        search_block,
        replace_block
      );

      // Create backup for atomic recovery
      if (!this.backups.has(absPath)) {
        this.backups.set(absPath, []);
      }
      this.backups.get(absPath)!.push({
        content: originalContent,
        timestamp: Date.now()
      });

      // Write patched content
      await fs.writeFile(absPath, patchedContent, 'utf-8');

      return {
        success: true,
        output: `Successfully applied patch to "${file_path}" (${match.matchType} match, similarity: ${(match.similarity * 100).toFixed(1)}%)\n\n${diffText}`,
        metadata: {
          matchType: match.matchType,
          similarity: match.similarity,
          diff: diffText,
          linesChanged: match.endLine - match.startLine
        }
      };
    } catch (err: any) {
      return {
        success: false,
        output: '',
        error: `Patch failed on "${file_path}": ${err.message}`
      };
    }
  }
}
