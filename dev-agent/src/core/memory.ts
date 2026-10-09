/**
 * @file Session persistence and resume manager
 * Corresponds to Module E in the functional specification
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { ChatMessage } from './context.js';

export interface AgentSessionData {
  sessionId: string;
  createdAt: number;
  updatedAt: number;
  workspaceRoot: string;
  messages: ChatMessage[];
  metadata: {
    totalTokens: number;
    patchesApplied: number;
    commandsExecuted: number;
    model: string;
  };
}

export class MemoryStore {
  private sessionsDir: string;

  constructor(workspaceRoot: string) {
    this.sessionsDir = path.resolve(workspaceRoot, '.agent_sessions');
  }

  private async ensureDir(): Promise<void> {
    try {
      await fs.mkdir(this.sessionsDir, { recursive: true });
    } catch {
      // directory already exists
    }
  }

  /**
   * Persists the session state atomically to JSON
   */
  async saveSession(session: AgentSessionData): Promise<string> {
    await this.ensureDir();
    const filePath = path.join(this.sessionsDir, `${session.sessionId}.json`);
    const tempPath = path.join(this.sessionsDir, `${session.sessionId}.tmp`);

    const json = JSON.stringify(session, null, 2);
    await fs.writeFile(tempPath, json, 'utf-8');
    await fs.rename(tempPath, filePath);

    return filePath;
  }

  /**
   * Loads a persisted session by ID
   */
  async loadSession(sessionId: string): Promise<AgentSessionData | null> {
    await this.ensureDir();
    const filePath = path.join(this.sessionsDir, `${sessionId}.json`);
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content) as AgentSessionData;
    } catch {
      return null;
    }
  }

  /**
   * Lists all available past sessions
   */
  async listSessions(): Promise<Array<{ sessionId: string; updatedAt: number; messageCount: number }>> {
    await this.ensureDir();
    try {
      const files = await fs.readdir(this.sessionsDir);
      const sessions = [];

      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        const sessionId = file.replace('.json', '');
        try {
          const content = await fs.readFile(path.join(this.sessionsDir, file), 'utf-8');
          const data = JSON.parse(content) as AgentSessionData;
          sessions.push({
            sessionId,
            updatedAt: data.updatedAt,
            messageCount: data.messages.length
          });
        } catch {
          // ignore corrupted files
        }
      }

      return sessions.sort((a, b) => b.updatedAt - a.updatedAt);
    } catch {
      return [];
    }
  }
}
