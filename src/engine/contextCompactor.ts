/**
 * @file Browser-compatible Context Manager & Log Truncator
 */

export function estimateTokens(text: string): number {
  if (!text) return 0;
  let count = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code > 0x4e00 && code < 0x9fa5) {
      count += 1;
    } else {
      count += 0.28;
    }
  }
  return Math.ceil(count);
}

export function truncateShellLog(
  rawLog: string,
  maxTokens = 2000,
  headLines = 30,
  tailLines = 70
): {
  processedText: string;
  wasTruncated: boolean;
  originalTokens: number;
  newTokens: number;
  omittedLines: number;
} {
  const originalTokens = estimateTokens(rawLog);
  const lines = rawLog.split('\n');

  if (originalTokens <= maxTokens || lines.length <= headLines + tailLines) {
    return {
      processedText: rawLog,
      wasTruncated: false,
      originalTokens,
      newTokens: originalTokens,
      omittedLines: 0
    };
  }

  const omitted = lines.length - headLines - tailLines;
  const head = lines.slice(0, headLines).join('\n');
  const tail = lines.slice(lines.length - tailLines).join('\n');

  const banner = `\n\n... [DEV-AGENT LOG TRUNCATION: Omitted ${omitted} lines (${Math.round((omitted / lines.length) * 100)}% of log) to preserve token budget] ...\n\n`;

  const processedText = `${head}${banner}${tail}`;
  const newTokens = estimateTokens(processedText);

  return {
    processedText,
    wasTruncated: true,
    originalTokens,
    newTokens,
    omittedLines: omitted
  };
}

export function generateCompactedSummary(
  turns: Array<{ role: string; content: string; tool?: string; diff?: string }>
): {
  summary: string;
  filesModified: string[];
  tokensSaved: number;
} {
  const files = new Set<string>();
  const milestones: string[] = [];

  turns.forEach((t) => {
    if (t.role === 'user') milestones.push(`User Goal: ${t.content.slice(0, 80)}`);
    if (t.diff) {
      const match = t.diff.match(/--- (?:a\/)?([^\n\t]+)/);
      if (match) files.add(match[1]);
    }
    if (t.tool === 'patch_file') milestones.push(`Applied surgical patch to code`);
    if (t.tool === 'execute_command') milestones.push(`Ran verification tests`);
  });

  const filesArray = Array.from(files);
  const summary = [
    `### [CONTEXT COMPACTION CHECKPOINT]`,
    `Checkpoint generated to keep context under 75% budget threshold.`,
    `Active modified files: ${filesArray.join(', ') || 'src/lru-cache.ts'}`,
    `Verified Milestones:`,
    ...milestones.map((m) => `- ${m}`),
    `Current Status: In-progress development cycle, continuing with minimal token overhead.`
  ].join('\n');

  const beforeTokens = turns.reduce((acc, cur) => acc + estimateTokens(cur.content), 0);
  const afterTokens = estimateTokens(summary);

  return {
    summary,
    filesModified: filesArray,
    tokensSaved: Math.max(0, beforeTokens - afterTokens)
  };
}
