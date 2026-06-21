import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';

// Walk up from `cwd` to find the nearest .git/HEAD file.
// Returns null if not in a git repository or the branch cannot be determined.
export async function readGitBranch(cwd: string): Promise<string | null> {
  let dir = cwd;
  // Safety cap: stop after 32 levels to avoid infinite loops on malformed paths
  for (let i = 0; i < 32; i++) {
    const result = await tryReadHead(dir);
    if (result !== undefined) return result;
    const parent = dirname(dir);
    if (parent === dir) break; // reached filesystem root
    dir = parent;
  }
  return null;
}

// Returns the branch string if .git/HEAD exists in `dir`, undefined if the
// directory does not contain a .git dir, or null for detached HEAD.
async function tryReadHead(dir: string): Promise<string | null | undefined> {
  const headPath = join(dir, '.git', 'HEAD');
  let content: string;
  try {
    content = await readFile(headPath, 'utf8');
  } catch {
    return undefined; // no .git here, keep walking
  }

  const trimmed = content.trim();
  if (trimmed.startsWith('ref: refs/heads/')) {
    return trimmed.slice('ref: refs/heads/'.length);
  }
  // Detached HEAD: return a shortened commit hash
  if (/^[0-9a-f]{40}$/i.test(trimmed)) {
    return trimmed.slice(0, 7);
  }
  return null;
}
