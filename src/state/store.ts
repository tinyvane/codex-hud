import { open, readFile, writeFile, mkdir, rename, stat, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { INITIAL_STATE, HUD_VERSION } from './types.js';
import type { HudState } from './types.js';
import type { FileHandle } from 'node:fs/promises';

export const STATE_DIR = join(homedir(), '.codex-hud');
const STATE_FILE = join(STATE_DIR, 'state.json');
const LOCK_FILE = join(STATE_DIR, 'state.lock');
const LOCK_TIMEOUT_MS = 8_000;
const LOCK_STALE_MS = 30_000;

const delay = async (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

export async function readState(): Promise<HudState> {
  try {
    const raw = await readFile(STATE_FILE, 'utf8');
    const parsed = JSON.parse(raw) as Partial<HudState>;
    // Ensure hudVersion reflects the running binary, not an old saved value
    return {
      ...INITIAL_STATE,
      ...parsed,
      tokens: { ...INITIAL_STATE.tokens, ...parsed.tokens },
      rateLimits: { ...INITIAL_STATE.rateLimits, ...parsed.rateLimits },
      hudVersion: HUD_VERSION,
    };
  } catch {
    return { ...INITIAL_STATE };
  }
}

async function writeStateUnlocked(state: HudState): Promise<void> {
  await mkdir(STATE_DIR, { recursive: true });
  const content = JSON.stringify(state, null, 2) + '\n';
  const temporaryFile = join(STATE_DIR, `state.${process.pid}.${randomUUID()}.tmp`);
  try {
    await writeFile(temporaryFile, content, { encoding: 'utf8' });
    await rename(temporaryFile, STATE_FILE);
  } catch (error) {
    await unlink(temporaryFile).catch(() => undefined);
    throw error;
  }
}

async function removeStaleLock(now: number): Promise<void> {
  try {
    const lock = await stat(LOCK_FILE);
    if (now - lock.mtimeMs > LOCK_STALE_MS) {
      await unlink(LOCK_FILE);
    }
  } catch {
    // Another process released the lock or it was never present.
  }
}

async function withStateLock<T>(operation: () => Promise<T>): Promise<T> {
  await mkdir(STATE_DIR, { recursive: true });
  const deadline = Date.now() + LOCK_TIMEOUT_MS;
  let handle: FileHandle | undefined;

  while (!handle) {
    try {
      handle = await open(LOCK_FILE, 'wx');
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'EEXIST') throw error;
      await removeStaleLock(Date.now());
      if (Date.now() >= deadline) {
        throw new Error('Timed out waiting for the HUD state lock');
      }
      await delay(20);
    }
  }

  try {
    return await operation();
  } finally {
    await handle.close();
    await unlink(LOCK_FILE).catch(() => undefined);
  }
}

export async function writeState(state: HudState): Promise<void> {
  await withStateLock(() => writeStateUnlocked(state));
}

export async function updateState(
  update: (current: HudState) => HudState | Promise<HudState>,
): Promise<HudState> {
  return withStateLock(async () => {
    const current = await readState();
    const next = await update(current);
    if (next !== current) {
      await writeStateUnlocked(next);
    }
    return next;
  });
}
