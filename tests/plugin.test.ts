import { describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { findPluginRoot } from '../src/plugin.js';

const readJson = async (path: string): Promise<Record<string, unknown>> =>
  JSON.parse(await readFile(path, 'utf8')) as Record<string, unknown>;

async function runBundledHook(
  bundlePath: string,
  home: string,
  payload: Record<string, unknown>,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, [bundlePath, 'hook'], {
      env: { ...process.env, HOME: home, USERPROFILE: home },
      stdio: ['pipe', 'ignore', 'pipe'],
    });
    let stderr = '';
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`bundled hook exited ${code}: ${stderr}`));
    });
    child.stdin.end(JSON.stringify(payload));
  });
}

describe('marketplace plugin', () => {
  it('keeps package, plugin, and rendered HUD versions aligned', async () => {
    const packageJson = await readJson(join(process.cwd(), 'package.json'));
    const manifest = await readJson(
      join(process.cwd(), 'plugins', 'codex-hud', '.codex-plugin', 'plugin.json'),
    );

    expect(manifest['name']).toBe('codex-hud');
    expect(manifest['version']).toBe(packageJson['version']);
  });

  it('exposes the plugin from the repository marketplace', async () => {
    const marketplace = await readJson(
      join(process.cwd(), '.agents', 'plugins', 'marketplace.json'),
    );
    const plugins = marketplace['plugins'] as Array<Record<string, unknown>>;
    const entry = plugins.find((plugin) => plugin['name'] === 'codex-hud');

    expect(entry).toBeDefined();
    expect(entry?.['source']).toEqual({ source: 'local', path: './plugins/codex-hud' });
    expect(entry?.['policy']).toEqual({ installation: 'AVAILABLE', authentication: 'ON_INSTALL' });
  });

  it('bundles cross-platform commands for every required lifecycle event', async () => {
    const config = await readJson(
      join(process.cwd(), 'plugins', 'codex-hud', 'hooks', 'hooks.json'),
    );
    const hooks = config['hooks'] as Record<
      string,
      Array<{ hooks: Array<{ command: string; commandWindows: string }> }>
    >;
    const expectedEvents = [
      'SessionStart',
      'PreToolUse',
      'PostToolUse',
      'SubagentStart',
      'SubagentStop',
      'Stop',
    ];

    expect(Object.keys(hooks).sort()).toEqual([...expectedEvents].sort());
    for (const event of expectedEvents) {
      const handler = hooks[event]?.[0]?.hooks[0];
      expect(handler?.command).toContain('${CLAUDE_PLUGIN_ROOT}/dist/cli.js');
      expect(handler?.commandWindows).toContain('%CLAUDE_PLUGIN_ROOT%/dist/cli.js');
    }
  });

  it('serializes concurrent hook updates in the bundled runtime', async () => {
    const home = await mkdtemp(join(tmpdir(), 'codex-hud-runtime-'));
    const bundlePath = join(process.cwd(), 'plugins', 'codex-hud', 'dist', 'cli.js');
    const common = {
      session_id: 'session-1',
      cwd: process.cwd(),
      model: 'gpt-5',
      transcript_path: join(home, 'transcript.jsonl'),
    };

    try {
      await runBundledHook(bundlePath, home, {
        ...common,
        hook_event_name: 'SessionStart',
        source: 'startup',
      });
      await Promise.all(
        Array.from({ length: 8 }, (_, index) =>
          runBundledHook(bundlePath, home, {
            ...common,
            hook_event_name: 'SubagentStart',
            agent_id: `agent-${index}`,
            agent_type: 'worker',
            turn_id: 'turn-1',
          }),
        ),
      );

      const state = await readJson(join(home, '.codex-hud', 'state.json'));
      expect(state['subagentCount']).toBe(8);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  }, 15_000);
});

describe('findPluginRoot', () => {
  it('prefers a valid plugin root from the hook environment', async () => {
    const root = await mkdtemp(join(tmpdir(), 'codex-hud-plugin-'));
    try {
      await mkdir(join(root, '.codex-plugin'), { recursive: true });
      await writeFile(join(root, '.codex-plugin', 'plugin.json'), '{}');

      await expect(findPluginRoot(import.meta.url, { CLAUDE_PLUGIN_ROOT: root })).resolves.toBe(
        root,
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('detects a plugin root relative to the bundled entry point', async () => {
    const root = await mkdtemp(join(tmpdir(), 'codex-hud-plugin-'));
    try {
      await mkdir(join(root, '.codex-plugin'), { recursive: true });
      await writeFile(join(root, '.codex-plugin', 'plugin.json'), '{}');
      const entryUrl = pathToFileURL(join(root, 'dist', 'cli.js')).href;

      await expect(findPluginRoot(entryUrl, {})).resolves.toBe(root);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('returns null outside a plugin', async () => {
    await expect(findPluginRoot(import.meta.url, {})).resolves.toBeNull();
  });
});
