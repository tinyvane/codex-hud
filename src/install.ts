import { readFile, writeFile, copyFile, mkdir, rename, unlink } from 'node:fs/promises';
import { CODEX_DIR, CODEX_HOOKS_FILE } from './config/detect.js';
import { readCodexConfig, writeCodexConfig } from './config/codex.js';

// ---------------------------------------------------------------------------
// Types matching the Codex hooks.json schema
// ---------------------------------------------------------------------------

export interface HookEntry {
  type: 'command';
  command: string;
  commandWindows?: string;
  statusMessage?: string;
  timeout?: number;
}

export interface MatcherGroup {
  matcher?: string;
  hooks: HookEntry[];
}

export interface HooksConfig {
  hooks?: Record<string, MatcherGroup[]>;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const HUD_COMMAND = 'codex-hud hook';

// Events where the HUD needs to update state
const EVENTS_TO_HOOK = [
  'SessionStart',
  'PreToolUse',
  'PostToolUse',
  'SubagentStart',
  'SubagentStop',
  'Stop',
] as const;

// ---------------------------------------------------------------------------
// Pure helpers (exported for unit testing)
// ---------------------------------------------------------------------------

export function makeHudMatcherGroup(): MatcherGroup {
  return { hooks: [{ type: 'command', command: HUD_COMMAND }] };
}

export function isHudMatcherGroup(group: MatcherGroup): boolean {
  return group.hooks.some((h) => h.command === HUD_COMMAND);
}

export function mergeHudHooks(
  config: HooksConfig,
  events: readonly string[] = EVENTS_TO_HOOK,
): { config: HooksConfig; added: string[] } {
  const hooks: Record<string, MatcherGroup[]> = { ...(config.hooks ?? {}) };
  const added: string[] = [];

  for (const event of events) {
    const existing = hooks[event] ?? [];
    if (!existing.some(isHudMatcherGroup)) {
      hooks[event] = [...existing, makeHudMatcherGroup()];
      added.push(event);
    }
  }

  return { config: { ...config, hooks }, added };
}

export function removeHudHooks(config: HooksConfig): { config: HooksConfig; removed: string[] } {
  if (!config.hooks) return { config, removed: [] };

  const hooks: Record<string, MatcherGroup[]> = {};
  const removed: string[] = [];

  for (const [event, groups] of Object.entries(config.hooks)) {
    const filtered = groups.filter((g) => !isHudMatcherGroup(g));
    if (filtered.length < groups.length) {
      removed.push(event);
    }
    if (filtered.length > 0) {
      hooks[event] = filtered;
    }
  }

  return { config: { ...config, hooks }, removed };
}

// ---------------------------------------------------------------------------
// I/O helpers
// ---------------------------------------------------------------------------

export async function readHooksConfig(): Promise<HooksConfig> {
  try {
    const raw = await readFile(CODEX_HOOKS_FILE, 'utf8');
    return JSON.parse(raw) as HooksConfig;
  } catch (err) {
    const e = err as { code?: string };
    if (e.code === 'ENOENT') return {};
    throw new Error(`Failed to read hooks.json: ${(err as Error).message}`);
  }
}

async function writeHooksConfig(config: HooksConfig): Promise<void> {
  await mkdir(CODEX_DIR, { recursive: true });
  const tmp = `${CODEX_HOOKS_FILE}.tmp`;
  await writeFile(tmp, JSON.stringify(config, null, 2) + '\n', { encoding: 'utf8' });
  await rename(tmp, CODEX_HOOKS_FILE);
}

async function backupHooksConfig(): Promise<void> {
  try {
    await copyFile(CODEX_HOOKS_FILE, `${CODEX_HOOKS_FILE}.bak`);
  } catch {
    // Nothing to back up — that is fine
  }
}

// ---------------------------------------------------------------------------
// Public commands
// ---------------------------------------------------------------------------

export async function install(): Promise<{ eventsAdded: string[] }> {
  await backupHooksConfig();

  const existing = await readHooksConfig();
  const { config: merged, added } = mergeHudHooks(existing);

  if (added.length > 0) {
    await writeHooksConfig(merged);
  }

  // Ensure features.hooks = true in config.toml
  const tomlConfig = await readCodexConfig();
  if (!tomlConfig.features?.hooks) {
    await writeCodexConfig({
      ...tomlConfig,
      features: { ...tomlConfig.features, hooks: true },
    });
  }

  return { eventsAdded: added };
}

export async function uninstall(): Promise<{ eventsRemoved: string[] }> {
  const existing = await readHooksConfig();
  const { config: cleaned, removed } = removeHudHooks(existing);

  if (removed.length > 0) {
    await backupHooksConfig();
    const remainingEvents = Object.keys(cleaned.hooks ?? {});
    if (remainingEvents.length === 0 && Object.keys(cleaned).length <= 1) {
      // hooks.json would be empty — remove it
      try {
        await unlink(CODEX_HOOKS_FILE);
      } catch {
        // Already gone
      }
    } else {
      await writeHooksConfig(cleaned);
    }
  }

  return { eventsRemoved: removed };
}
