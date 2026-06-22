import { access, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const pluginRoot = join(root, 'plugins', 'codex-hud');
const manifestPath = join(pluginRoot, '.codex-plugin', 'plugin.json');
const marketplacePath = join(root, '.agents', 'plugins', 'marketplace.json');
const hooksPath = join(pluginRoot, 'hooks', 'hooks.json');
const bundlePath = join(pluginRoot, 'dist', 'cli.js');
const packagePath = join(root, 'package.json');

const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const [manifest, marketplace, hooks, packageJson] = await Promise.all(
  [manifestPath, marketplacePath, hooksPath, packagePath].map(readJson),
);

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

assert(manifest.name === 'codex-hud', 'plugin name must be codex-hud');
assert(manifest.version === packageJson.version, 'plugin and package versions must match');
assert(/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(manifest.version), 'invalid semver');
assert(manifest.skills === './skills/', 'plugin must expose its skills directory');
assert(Array.isArray(manifest.interface?.defaultPrompt), 'defaultPrompt must be an array');
assert(manifest.interface.defaultPrompt.length <= 3, 'defaultPrompt supports at most 3 entries');
assert(marketplace.name === 'codex-hud', 'repository marketplace name must be codex-hud');
assert(
  marketplace.interface?.displayName === 'Codex HUD',
  'repository marketplace display name must be Codex HUD',
);

const entry = marketplace.plugins?.find((plugin) => plugin.name === manifest.name);
assert(entry, 'marketplace is missing codex-hud');
assert(entry.source?.source === 'local', 'marketplace source must be local');
assert(entry.source?.path === './plugins/codex-hud', 'marketplace source path is incorrect');
assert(entry.policy?.installation === 'AVAILABLE', 'plugin must be available to install');
assert(entry.policy?.authentication === 'ON_INSTALL', 'authentication policy is missing');

const expectedEvents = [
  'SessionStart',
  'PreToolUse',
  'PostToolUse',
  'SubagentStart',
  'SubagentStop',
  'Stop',
];
assert(
  Object.keys(hooks).length === 1 && typeof hooks.hooks === 'object',
  'hooks config must contain only the top-level hooks field',
);
for (const event of expectedEvents) {
  const handlers = hooks.hooks?.[event]?.flatMap((group) => group.hooks ?? []) ?? [];
  assert(handlers.length === 1, `${event} must have exactly one HUD hook`);
  assert(
    handlers[0].command.includes('${CLAUDE_PLUGIN_ROOT}/dist/cli.js'),
    `${event} Unix command must use the plugin root`,
  );
  assert(
    handlers[0].commandWindows.includes('%CLAUDE_PLUGIN_ROOT%/dist/cli.js'),
    `${event} Windows command must use the plugin root`,
  );
}

await access(bundlePath, constants.R_OK);
const result = spawnSync(process.execPath, [bundlePath, '--version'], {
  cwd: root,
  encoding: 'utf8',
});
assert(result.status === 0, `plugin runtime failed: ${result.stderr || result.stdout}`);
assert(
  result.stdout.trim() === `codex-hud ${manifest.version}`,
  'plugin runtime reported the wrong version',
);

process.stdout.write(`Validated codex-hud plugin ${manifest.version}\n`);
