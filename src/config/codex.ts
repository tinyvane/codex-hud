import { readFile, writeFile, copyFile, mkdir, rename, unlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
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

export const HUD_STATUS_LINE = [
  'model-with-reasoning',
  'status',
  'context-remaining',
  'git-branch',
  'task-progress',
] as const;

export function mergeHudStatusLine(config: CodexConfig): {
  config: CodexConfig;
  changed: boolean;
} {
  const current = config.tui?.status_line ?? [];
  const statusLine = [...current];
  for (const item of HUD_STATUS_LINE) {
    if (!statusLine.includes(item)) statusLine.push(item);
  }

  const changed =
    current.length !== statusLine.length ||
    current.some((item, index) => item !== statusLine[index]);
  return {
    config: { ...config, tui: { ...config.tui, status_line: statusLine } },
    changed,
  };
}

export function hasHudStatusLine(config: CodexConfig): boolean {
  const configured = config.tui?.status_line;
  return Array.isArray(configured) && HUD_STATUS_LINE.every((item) => configured.includes(item));
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
  const temporaryPath = join(
    dirname(CODEX_CONFIG_FILE),
    `config.${process.pid}.${randomUUID()}.tmp`,
  );
  try {
    await writeFile(temporaryPath, toml, { encoding: 'utf8' });
    await rename(temporaryPath, CODEX_CONFIG_FILE);
  } catch (error) {
    await unlink(temporaryPath).catch(() => undefined);
    throw error;
  }
}

export async function setupHudStatusLine(): Promise<{ changed: boolean }> {
  const current = await readCodexConfig();
  const merged = mergeHudStatusLine(current);
  if (merged.changed) await writeCodexConfig(merged.config);
  return { changed: merged.changed };
}
