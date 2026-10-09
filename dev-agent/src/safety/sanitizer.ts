/**
 * @file Sanitizer for redacting secrets, API keys, and sensitive environment data
 */

const SECRET_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  { name: 'OpenAI/Claude API Key', pattern: /(?:sk-[a-zA-Z0-9_-]{20,}|anthropic-[a-zA-Z0-9_-]{20,})/gi },
  { name: 'Google API Key', pattern: /AIza[0-9A-Za-z-_]{35}/g },
  { name: 'AWS Access Key', pattern: /(?:A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}/g },
  { name: 'GitHub Token', pattern: /(?:ghp|gho|ghu|ghs|ghr)_[a-zA-Z0-9_]{36,255}/g },
  { name: 'Private Key', pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----[\s\S]+?-----END (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g },
  { name: 'JWT Token', pattern: /ey[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g },
  { name: 'Generic Password / Secret in URI', pattern: /(?:mongodb|postgres|mysql|redis):\/\/[^:\s]+:([^@\s]+)@/gi },
  { name: 'ENV Variable Assignment', pattern: /(?:API_KEY|SECRET|PASSWORD|AUTH_TOKEN|PRIVATE_KEY)\s*=\s*['"]?([^\s'"]{8,})['"]?/gi },
];

/**
 * Redacts secrets from strings before sending to LLM or displaying in UI logs
 */
export function sanitizeOutput(text: string): { cleanText: string; redactedCount: number } {
  let cleanText = text;
  let redactedCount = 0;

  for (const { name, pattern } of SECRET_PATTERNS) {
    cleanText = cleanText.replace(pattern, (match) => {
      redactedCount++;
      // If it matched an assignment, preserve the key name
      if (match.includes('=')) {
        const [k] = match.split('=');
        return `${k.trim()}=[REDACTED_SECRET_${name.toUpperCase().replace(/\s+/g, '_')}]`;
      }
      return `[REDACTED_SECRET_${name.toUpperCase().replace(/\s+/g, '_')}]`;
    });
  }

  return { cleanText, redactedCount };
}

/**
 * Checks if a file path is a secret file (e.g., .env, .env.local, id_rsa)
 */
export function isSensitiveFilePath(relativePath: string): boolean {
  const normalized = relativePath.toLowerCase().replace(/\\/g, '/');
  const sensitiveFiles = [
    '.env',
    '.env.local',
    '.env.production',
    '.env.development',
    'id_rsa',
    'id_ed25519',
    'credentials.json',
    'service-account.json',
    '.npmrc',
    '.netrc'
  ];

  return sensitiveFiles.some((f) => normalized.endsWith(f) || normalized.includes(`/${f}`));
}
