/**
 * @file Browser-compatible Surgical File Patcher and Levenshtein Matcher
 */

import * as diff from 'diff';

export function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  let prevRow = new Array(n + 1);
  let currRow = new Array(n + 1);

  for (let j = 0; j <= n; j++) prevRow[j] = j;

  for (let i = 1; i <= m; i++) {
    currRow[0] = i;
    const aChar = a[i - 1];
    for (let j = 1; j <= n; j++) {
      const cost = aChar === b[j - 1] ? 0 : 1;
      currRow[j] = Math.min(
        currRow[j - 1] + 1,
        prevRow[j] + 1,
        prevRow[j - 1] + cost
      );
    }
    const temp = prevRow;
    prevRow = currRow;
    currRow = temp;
  }

  return prevRow[n];
}

export function stringSimilarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1.0;
  const distance = levenshteinDistance(a, b);
  return 1.0 - distance / maxLen;
}

export function normalizeLine(line: string): string {
  return line.trim().replace(/\s+/g, ' ');
}

export interface MatchResult {
  startLine: number;
  endLine: number;
  matchType: 'exact' | 'whitespace-normalized' | 'fuzzy-levenshtein';
  similarity: number;
  candidateSnippet: string;
}

export function runFuzzyPatcher(
  fileContent: string,
  searchBlock: string,
  replaceBlock: string,
  fuzzyThreshold = 0.80
): {
  success: boolean;
  match?: MatchResult;
  patchedContent?: string;
  diffText?: string;
  error?: string;
} {
  try {
    if (!fileContent.trim()) throw new Error('File content is empty.');
    if (!searchBlock.trim()) throw new Error('Search block cannot be empty.');

    const fileLines = fileContent.split('\n');

    // 1. Exact Match
    const exactIndex = fileContent.indexOf(searchBlock);
    if (exactIndex !== -1) {
      const secondIndex = fileContent.indexOf(searchBlock, exactIndex + 1);
      if (secondIndex !== -1) {
        throw new Error('Ambiguous match: search_block appears multiple times in file. Provide more context.');
      }
      const before = fileContent.slice(0, exactIndex);
      const startLine = before.split('\n').length - 1;
      const searchLinesCount = searchBlock.split('\n').length;
      const match: MatchResult = {
        startLine,
        endLine: startLine + searchLinesCount,
        matchType: 'exact',
        similarity: 1.0,
        candidateSnippet: fileLines.slice(startLine, startLine + searchLinesCount).join('\n')
      };

      const patchedLines = [
        ...fileLines.slice(0, startLine),
        ...replaceBlock.split('\n'),
        ...fileLines.slice(startLine + searchLinesCount)
      ];
      const patchedContent = patchedLines.join('\n');
      const diffText = diff.createTwoFilesPatch('target.ts', 'target.ts', fileContent, patchedContent);

      return { success: true, match, patchedContent, diffText };
    }

    // 2. Whitespace Normalized
    const searchLines = searchBlock.split('\n');
    const searchLinesNorm = searchLines.map(normalizeLine);
    const normalizedMatches: number[] = [];

    for (let i = 0; i <= fileLines.length - searchLines.length; i++) {
      let matches = true;
      for (let j = 0; j < searchLines.length; j++) {
        if (normalizeLine(fileLines[i + j]) !== searchLinesNorm[j]) {
          matches = false;
          break;
        }
      }
      if (matches) normalizedMatches.push(i);
    }

    if (normalizedMatches.length === 1) {
      const startLine = normalizedMatches[0];
      const match: MatchResult = {
        startLine,
        endLine: startLine + searchLines.length,
        matchType: 'whitespace-normalized',
        similarity: 0.95,
        candidateSnippet: fileLines.slice(startLine, startLine + searchLines.length).join('\n')
      };

      const matchedSlice = fileLines.slice(startLine, startLine + searchLines.length);
      const origIndent = matchedSlice[0]?.match(/^([ \t]*)/)?.[1] || '';
      const searchIndent = searchLines[0]?.match(/^([ \t]*)/)?.[1] || '';
      const replaceLines = replaceBlock.split('\n').map((l) => {
        if (l.startsWith(searchIndent)) return origIndent + l.slice(searchIndent.length);
        return l;
      });

      const patchedLines = [
        ...fileLines.slice(0, startLine),
        ...replaceLines,
        ...fileLines.slice(startLine + searchLines.length)
      ];
      const patchedContent = patchedLines.join('\n');
      const diffText = diff.createTwoFilesPatch('target.ts', 'target.ts', fileContent, patchedContent);

      return { success: true, match, patchedContent, diffText };
    }

    // 3. Levenshtein Sliding Window Fuzzy Match
    let bestMatch: MatchResult | null = null;
    let highestScore = 0;
    const windowSizes = [searchLines.length, Math.max(1, searchLines.length - 1), searchLines.length + 1];
    const searchJoined = searchLinesNorm.join('\n');

    for (const wSize of windowSizes) {
      if (wSize > fileLines.length) continue;
      for (let i = 0; i <= fileLines.length - wSize; i++) {
        const candidateSlice = fileLines.slice(i, i + wSize);
        const candidateJoined = candidateSlice.map(normalizeLine).join('\n');
        const score = stringSimilarity(searchJoined, candidateJoined);

        if (score > highestScore) {
          highestScore = score;
          bestMatch = {
            startLine: i,
            endLine: i + wSize,
            matchType: 'fuzzy-levenshtein',
            similarity: score,
            candidateSnippet: candidateSlice.join('\n')
          };
        }
      }
    }

    if (bestMatch && highestScore >= fuzzyThreshold) {
      const matchedSlice = fileLines.slice(bestMatch.startLine, bestMatch.endLine);
      const origIndent = matchedSlice[0]?.match(/^([ \t]*)/)?.[1] || '';
      const searchIndent = searchLines[0]?.match(/^([ \t]*)/)?.[1] || '';
      const replaceLines = replaceBlock.split('\n').map((l) => {
        if (l.startsWith(searchIndent)) return origIndent + l.slice(searchIndent.length);
        return l;
      });

      const patchedLines = [
        ...fileLines.slice(0, bestMatch.startLine),
        ...replaceLines,
        ...fileLines.slice(bestMatch.endLine)
      ];
      const patchedContent = patchedLines.join('\n');
      const diffText = diff.createTwoFilesPatch('target.ts', 'target.ts', fileContent, patchedContent);

      return { success: true, match: bestMatch, patchedContent, diffText };
    }

    return {
      success: false,
      error: `No match found exceeding fuzzy threshold of ${(fuzzyThreshold * 100).toFixed(0)}%. Best match score was ${(highestScore * 100).toFixed(1)}%.`
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
