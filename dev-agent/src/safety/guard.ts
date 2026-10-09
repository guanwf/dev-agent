/**
 * @file Safety Guard & Permission Sandbox
 * Corresponds to the Permission module in mini-claude-code architecture
 */

import path from 'node:path';
import { isSensitiveFilePath } from './sanitizer.js';

export interface GuardCheckResult {
  allowed: boolean;
  reason?: string;
  isDestructive: boolean;
  requiresHITLConfirmation: boolean;
}

const DANGEROUS_COMMAND_RULES: Array<{ pattern: RegExp; reason: string }> = [
  {
    pattern: /(?:^|\s|;|&|\|)rm\s+-(?:r|f|rf|fr)\s+(?:\/|\/\*|~\/|~|\.\.\/|\$HOME)/i,
    reason: 'Attempted catastrophic recursive deletion of root, home, or parent directory'
  },
  {
    pattern: /(?:^|\s|;|&|\|)rm\s+-(?:r|f|rf|fr)\s+\./i,
    reason: 'Attempted deletion of entire current working directory root'
  },
  {
    pattern: /git\s+push\s+(?:.*--force|.*-f)\b/i,
    reason: 'Attempted destructive force push to remote Git repository'
  },
  {
    pattern: /git\s+reset\s+--hard\b/i,
    reason: 'Hard Git reset will discard uncommitted local work'
  },
  {
    pattern: /git\s+clean\s+-(?:f|fd|df|fx)\b/i,
    reason: 'Git clean will delete all untracked files'
  },
  {
    pattern: /(?:^|\s|;|&|\|)dd\s+if=/i,
    reason: 'Raw low-level disk writing (dd) blocked by safety guard'
  },
  {
    pattern: /(?:^|\s|;|&|\|)mkfs(?:\.[a-z0-9]+)?\s+/i,
    reason: 'Filesystem formatting command blocked'
  },
  {
    pattern: /:\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:/,
    reason: 'Fork bomb detected and blocked'
  },
  {
    pattern: /(?:curl|wget)\s+.*\|\s*(?:bash|sh|zsh)\b/i,
    reason: 'Executing untrusted remote shell script via pipe (curl | sh) blocked'
  },
  {
    pattern: />\s*(?:\/etc\/|\/boot\/|\/sys\/|\/dev\/)/i,
    reason: 'Redirecting output to critical system path blocked'
  },
];

const DESTRUCTIVE_COMMAND_KEYWORDS = [
  'rm ', 'unlink ', 'git checkout --', 'npm publish', 'yarn publish', 'pnpm publish', 'dropdb', 'truncate'
];

export class SafetyGuard {
  constructor(private readonly workspaceRoot: string) {}

  /**
   * Validates if a target path is strictly inside the workspace root (Jailbreak prevention).
   */
  validatePath(targetPath: string): GuardCheckResult {
    const resolvedPath = path.resolve(this.workspaceRoot, targetPath);
    const resolvedRoot = path.resolve(this.workspaceRoot);

    // Check if target is inside the workspace root
    const relative = path.relative(resolvedRoot, resolvedPath);
    const isInside = !relative.startsWith('..') && !path.isAbsolute(relative);

    if (!isInside && resolvedPath !== resolvedRoot) {
      return {
        allowed: false,
        reason: `Jailbreak detected: Path "${targetPath}" resolves outside workspace root (${resolvedRoot})`,
        isDestructive: true,
        requiresHITLConfirmation: false
      };
    }

    // Check sensitive files (.env, private keys)
    if (isSensitiveFilePath(relative)) {
      return {
        allowed: false,
        reason: `Sensitive file access blocked: "${targetPath}" is protected from model inspection`,
        isDestructive: false,
        requiresHITLConfirmation: false
      };
    }

    return {
      allowed: true,
      isDestructive: false,
      requiresHITLConfirmation: false
    };
  }

  /**
   * Validates if a shell command is safe to execute.
   */
  validateCommand(command: string): GuardCheckResult {
    const trimmed = command.trim();

    // 1. Check blacklist
    for (const rule of DANGEROUS_COMMAND_RULES) {
      if (rule.pattern.test(trimmed)) {
        return {
          allowed: false,
          reason: rule.reason,
          isDestructive: true,
          requiresHITLConfirmation: false
        };
      }
    }

    // 2. Check if it's destructive or modifies state, requiring Human-in-the-Loop confirmation
    const isDestructive = DESTRUCTIVE_COMMAND_KEYWORDS.some((kw) => trimmed.includes(kw));

    return {
      allowed: true,
      isDestructive,
      requiresHITLConfirmation: isDestructive
    };
  }
}
