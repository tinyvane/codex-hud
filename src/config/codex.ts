import { readFile, writeFile, copyFile, mkdir } from 'node:fs/promises';
import { parse, stringify } from 'smol-toml';
import { CODEX_DIR, CODEX_CONFIG_FILE } from './detect.js';

export interface CodexConfig {
  tui?: {
    status_line?: string[] | null;
    notifications?: boolean;
  };
  features?: {
    hooks?: boolean;
  };
  hooks?: Record<string, unknown>;
  [key: string]: unknown;
}

export async function readCodexConfig(): Promise<CodexConfig> {
  try {
    const raw = await readFile(CODEX_CONFIG_FILE, 'utf8');
    return parse(raw) as CodexConfig;
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === 'ENOENT') return {};
    throw new Error(`Failed to read Codex config: ${e.message}`);
  }
}

export async function writeCodexConfig(config: CodexConfig): Promise<void> {
  await mkdir(CODEX_DIR, { recursive: true });
  const backupPath = `${CODEX_CONFIG_FILE}.bak`;
  try {
    await copyFile(CODEX_CONFIG_FILE, backupPath);
  } catch {
    // No existing file to back up
  }
  const toml = stringify(config as Record<string, unknown>);
  await writeFile(CODEX_CONFIG_FILE, toml, { encoding: 'utf8' });
}
