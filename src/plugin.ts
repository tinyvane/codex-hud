import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const MANIFEST_PATH = join('.codex-plugin', 'plugin.json');

async function isPluginRoot(path: string): Promise<boolean> {
  try {
    await access(join(path, MANIFEST_PATH), constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

export async function findPluginRoot(
  entryUrl: string = import.meta.url,
  env: NodeJS.ProcessEnv = process.env,
): Promise<string | null> {
  const envRoot = env['PLUGIN_ROOT'] ?? env['CLAUDE_PLUGIN_ROOT'];
  if (envRoot) {
    const candidate = resolve(envRoot);
    if (await isPluginRoot(candidate)) return candidate;
  }

  const bundledCandidate = dirname(dirname(fileURLToPath(entryUrl)));
  return (await isPluginRoot(bundledCandidate)) ? bundledCandidate : null;
}
