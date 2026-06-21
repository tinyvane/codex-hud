import { chmod, mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const packagePath = join(root, 'package.json');
const manifestPath = join(root, 'plugins', 'codex-hud', '.codex-plugin', 'plugin.json');
const outputPath = join(root, 'plugins', 'codex-hud', 'dist', 'cli.js');

const [packageJson, manifest] = await Promise.all(
  [packagePath, manifestPath].map(async (path) => JSON.parse(await readFile(path, 'utf8'))),
);

if (packageJson.version !== manifest.version) {
  throw new Error(
    `Version mismatch: package.json=${packageJson.version}, plugin.json=${manifest.version}`,
  );
}

await mkdir(dirname(outputPath), { recursive: true });
await build({
  entryPoints: [join(root, 'src', 'cli.ts')],
  outfile: outputPath,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  packages: 'bundle',
  legalComments: 'none',
  sourcemap: false,
});

await chmod(outputPath, 0o755);
process.stdout.write(`Built marketplace plugin runtime: ${outputPath}\n`);
