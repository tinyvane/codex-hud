import { access, constants } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';

export const CODEX_DIR = join(homedir(), '.codex');
export const CODEX_CONFIG_FILE = join(CODEX_DIR, 'config.toml');
export const CODEX_HOOKS_FILE = join(CODEX_DIR, 'hooks.json');

export async function isCodexInstalled(): Promise<boolean> {
  try {
    await access(CODEX_DIR, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

export async function hasCodexConfig(): Promise<boolean> {
  try {
    await access(CODEX_CONFIG_FILE, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}
