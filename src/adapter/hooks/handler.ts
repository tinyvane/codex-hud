import { updateState } from '../../state/store.js';
import { reduce } from '../../state/reducer.js';
import { readGitBranch } from '../../git.js';
import type { HookPayload, HookResponse } from './schema.js';

// Exported for unit testing without I/O
export function parseHookPayload(input: string): HookPayload {
  let raw: unknown;
  try {
    raw = JSON.parse(input);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new SyntaxError(`Failed to parse hook payload: ${msg}`);
  }

  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new TypeError('Hook payload must be a JSON object');
  }

  const obj = raw as Record<string, unknown>;
  if (typeof obj['hook_event_name'] !== 'string') {
    throw new TypeError('Hook payload missing string field hook_event_name');
  }
  if (typeof obj['session_id'] !== 'string') {
    throw new TypeError('Hook payload missing string field session_id');
  }

  // Trust the remaining shape to match the declared event name.
  // Codex is the authoritative source; we do not re-validate every field.
  return obj as unknown as HookPayload;
}

export async function runHookHandler(input: string): Promise<HookResponse> {
  const payload = parseHookPayload(input);
  const now = Date.now();
  const gitBranch =
    payload.hook_event_name === 'SessionStart' ? await readGitBranch(payload.cwd) : undefined;

  await updateState((state) => {
    const next = reduce(state, payload, now);
    return gitBranch === undefined ? next : { ...next, gitBranch };
  });
  return {};
}
