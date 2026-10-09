/**
 * @file Browser-compatible Safety Guard and Secret Sanitizer
 */

export interface GuardEvaluation {
  allowed: boolean;
  category: 'safe' | 'dangerous' | 'jailbreak' | 'destructive';
  reason?: string;
  isDestructive: boolean;
  requiresHITL: boolean;
}

const BLACKLIST = [
  { pattern: /(?:^|\s|;|&|\|)rm\s+-(?:r|f|rf|fr)\s+(?:\/|\/\*|~\/|~|\.\.\/|\$HOME)/i, reason: 'Catastrophic recursive deletion of root, home, or parent directory' },
  { pattern: /(?:^|\s|;|&|\|)rm\s+-(?:r|f|rf|fr)\s+\./i, reason: 'Attempted deletion of entire current working directory root' },
  { pattern: /git\s+push\s+(?:.*--force|.*-f)\b/i, reason: 'Destructive force push to remote Git repository' },
  { pattern: /git\s+reset\s+--hard\b/i, reason: 'Hard Git reset will discard all uncommitted changes' },
  { pattern: /:\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:/, reason: 'Fork bomb exploit detected and blocked' },
  { pattern: /(?:curl|wget)\s+.*\|\s*(?:bash|sh|zsh)\b/i, reason: 'Executing arbitrary remote shell script via pipe' },
  { pattern: /dd\s+if=/i, reason: 'Direct disk byte writing blocked' },
  { pattern: /mkfs\b/i, reason: 'Disk format blocked' },
];

const DESTRUCTIVE_OPS = ['rm ', 'unlink ', 'npm publish', 'dropdb', 'git clean', 'chmod -R 777'];

export function evaluateCommandSafety(command: string): GuardEvaluation {
  const trimmed = command.trim();

  for (const item of BLACKLIST) {
    if (item.pattern.test(trimmed)) {
      return {
        allowed: false,
        category: 'dangerous',
        reason: item.reason,
        isDestructive: true,
        requiresHITL: false
      };
    }
  }

  const isDestructive = DESTRUCTIVE_OPS.some((k) => trimmed.includes(k));
  if (isDestructive) {
    return {
      allowed: true,
      category: 'destructive',
      reason: 'State-altering command detected. Requires explicit developer approval.',
      isDestructive: true,
      requiresHITL: true
    };
  }

  return {
    allowed: true,
    category: 'safe',
    isDestructive: false,
    requiresHITL: false
  };
}

export function evaluatePathSafety(inputPath: string): GuardEvaluation {
  const normalized = inputPath.replace(/\\/g, '/');

  if (normalized.startsWith('../') || normalized.includes('/../') || normalized === '..') {
    return {
      allowed: false,
      category: 'jailbreak',
      reason: 'Path traversal attempt: resolving outside workspace root sandbox.',
      isDestructive: false,
      requiresHITL: false
    };
  }

  if (normalized.startsWith('/') || normalized.startsWith('~')) {
    return {
      allowed: false,
      category: 'jailbreak',
      reason: 'Absolute system path access prohibited outside workspace root.',
      isDestructive: false,
      requiresHITL: false
    };
  }

  const sensitive = ['.env', '.env.local', 'id_rsa', 'id_ed25519', 'credentials.json'];
  if (sensitive.some((s) => normalized.endsWith(s) || normalized.includes(`/${s}`))) {
    return {
      allowed: false,
      category: 'jailbreak',
      reason: 'Access to credentials or environment secret file is strictly shielded.',
      isDestructive: false,
      requiresHITL: false
    };
  }

  return {
    allowed: true,
    category: 'safe',
    isDestructive: false,
    requiresHITL: false
  };
}

export function sanitizeSecrets(text: string): { cleanText: string; matches: Array<{ name: string; match: string }> } {
  const patterns: Array<{ name: string; regex: RegExp }> = [
    { name: 'Anthropic/OpenAI API Key', regex: /(?:sk-[a-zA-Z0-9_-]{20,}|anthropic-[a-zA-Z0-9_-]{20,})/gi },
    { name: 'Google API Key', regex: /AIza[0-9A-Za-z-_]{35}/g },
    { name: 'AWS Access Key', regex: /(?:AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}/g },
    { name: 'GitHub Token', regex: /(?:ghp|gho|ghu|ghs|ghr)_[a-zA-Z0-9_]{36,255}/g },
    { name: 'Private Key Block', regex: /-----BEGIN [A-Z ]+PRIVATE KEY-----[\s\S]+?-----END [A-Z ]+PRIVATE KEY-----/g },
  ];

  let cleanText = text;
  const matches: Array<{ name: string; match: string }> = [];

  for (const { name, regex } of patterns) {
    cleanText = cleanText.replace(regex, (m) => {
      matches.push({ name, match: m });
      return `[REDACTED_${name.toUpperCase().replace(/\s+/g, '_')}]`;
    });
  }

  return { cleanText, matches };
}
