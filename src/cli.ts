#!/usr/bin/env node
import { runHookHandler } from './adapter/hooks/handler.js';
import { readState, updateState } from './state/store.js';
import { renderStatusLine } from './renderer/status-line.js';
import { sanitize } from './renderer/sanitize.js';
import { formatDuration } from './renderer/format.js';
import { findPluginRoot } from './plugin.js';

const [, , command] = process.argv;

async function main(): Promise<void> {
  switch (command) {
    case 'hook': {
      const chunks: Buffer[] = [];
      for await (const chunk of process.stdin) {
        chunks.push(chunk as Buffer);
      }
      const input = Buffer.concat(chunks).toString('utf8').trim();
      if (!input) {
        process.stderr.write('codex-hud hook: empty stdin\n');
        process.exitCode = 1;
        return;
      }
      const response = await runHookHandler(input);
      process.stdout.write(JSON.stringify(response) + '\n');
      break;
    }

    case 'status': {
      const state = await readState();
      const line = renderStatusLine(state, Date.now());
      process.stdout.write(line + '\n');
      break;
    }

    case 'setup': {
      const { isCodexInstalled } = await import('./config/detect.js');
      const { setupHudStatusLine } = await import('./config/codex.js');
      if (!(await isCodexInstalled())) {
        process.stderr.write('codex-hud setup: Codex directory not found (~/.codex/)\n');
        process.exitCode = 1;
        return;
      }
      const { changed } = await setupHudStatusLine();
      process.stdout.write(
        changed
          ? 'codex-hud: configured the native Codex status line\nRestart Codex to display it.\n'
          : 'codex-hud: native Codex status line is already configured\n',
      );
      break;
    }

    case 'install': {
      if (await findPluginRoot()) {
        process.stdout.write(
          'codex-hud: plugin hooks are bundled and require no user configuration\n' +
            'Start a new Codex thread, review the hooks with /hooks, then run verification.\n',
        );
        break;
      }

      const { install } = await import('./install.js');
      const { isCodexInstalled } = await import('./config/detect.js');

      if (!(await isCodexInstalled())) {
        process.stderr.write(
          'codex-hud install: Codex directory not found (~/.codex/)\n' +
            'Install Codex first: https://developers.openai.com/codex\n',
        );
        process.exitCode = 1;
        return;
      }

      const { eventsAdded } = await install();
      if (eventsAdded.length === 0) {
        process.stdout.write('codex-hud: already installed (no changes needed)\n');
      } else {
        process.stdout.write(
          `codex-hud: installed hooks for ${eventsAdded.length} events:\n` +
            eventsAdded.map((e) => `  - ${e}`).join('\n') +
            '\n\nRun "codex-hud verify" to confirm.\n',
        );
      }
      break;
    }

    case 'uninstall': {
      const { uninstall } = await import('./install.js');
      const { eventsRemoved } = await uninstall();
      if (eventsRemoved.length === 0) {
        process.stdout.write('codex-hud: no hooks found to remove\n');
      } else {
        process.stdout.write(
          `codex-hud: removed hooks from ${eventsRemoved.length} events:\n` +
            eventsRemoved.map((e) => `  - ${e}`).join('\n') +
            '\n',
        );
      }
      break;
    }

    case 'verify': {
      const { isCodexInstalled } = await import('./config/detect.js');
      const { hasHudStatusLine, readCodexConfig } = await import('./config/codex.js');
      const { readHooksConfig } = await import('./install.js');

      const codexOk = await isCodexInstalled();
      process.stdout.write(`Codex:   ${codexOk ? 'installed' : 'NOT FOUND'}  (~/.codex/)\n`);

      const pluginRoot = await findPluginRoot();
      const hooksConfig = await readHooksConfig();
      const hookedEvents = Object.entries(hooksConfig.hooks ?? {})
        .filter(([, groups]) =>
          groups.some((g) => g.hooks.some((h) => h.command === 'codex-hud hook')),
        )
        .map(([event]) => event);

      if (pluginRoot) {
        process.stdout.write('Hooks:   bundled with installed plugin (review with /hooks)\n');
      } else if (hookedEvents.length > 0) {
        process.stdout.write(
          `Hooks:   configured  (${hookedEvents.length} events: ${hookedEvents.join(', ')})\n`,
        );
      } else {
        process.stdout.write(`Hooks:   NOT CONFIGURED  (run: codex-hud install)\n`);
      }

      const nativeHudConfigured = hasHudStatusLine(await readCodexConfig());
      process.stdout.write(
        nativeHudConfigured
          ? 'Display: native Codex status line configured\n'
          : 'Display: NOT CONFIGURED  (run: codex-hud setup)\n',
      );

      const now = Date.now();
      const state = await readState();

      if (state.lastUpdated > 0) {
        const age = formatDuration(now - state.lastUpdated);
        process.stdout.write(`State:   ~/.codex-hud/state.json  (updated ${age} ago)\n`);
        if (state.model) {
          process.stdout.write(`Model:   ${sanitize(state.model)}\n`);
        }
        if (state.gitBranch) {
          process.stdout.write(`Branch:  ${sanitize(state.gitBranch)}\n`);
        }
        if (state.sessionStart !== null) {
          process.stdout.write(
            `Session: ${formatDuration(now - state.sessionStart)}` +
              `  |  turns: ${state.turnCount}` +
              `  |  agents: ${state.subagentCount}\n`,
          );
        }
      } else {
        process.stdout.write(`State:   no session recorded yet\n`);
      }
      break;
    }

    case 'watch': {
      const { AppServerClient } = await import('./adapter/app-server/client.js');
      const { applyNotification } = await import('./adapter/app-server/events.js');

      let updateQueue = Promise.resolve();

      const enqueueUpdate = (
        update: Parameters<typeof updateState>[0],
        errorPrefix: string,
      ): void => {
        updateQueue = updateQueue
          .then(() => updateState(update))
          .then(() => undefined)
          .catch((err: Error) => {
            process.stderr.write(`${errorPrefix}: ${err.message}\n`);
          });
      };

      const client = new AppServerClient({
        onConnected: (): void => {
          process.stderr.write('codex-hud watch: connected to App Server\n');
          enqueueUpdate(
            (state) => ({ ...state, appServerConnected: true }),
            'codex-hud watch: write error',
          );
        },
        onDisconnected: (): void => {
          process.stderr.write('codex-hud watch: disconnected, reconnecting...\n');
          enqueueUpdate(
            (state) => ({ ...state, appServerConnected: false }),
            'codex-hud watch: write error',
          );
        },
        onError: (err): void => {
          process.stderr.write(`codex-hud watch: ${err.message}\n`);
        },
        onNotification: (notification): void => {
          enqueueUpdate(
            (state) => applyNotification(state, notification, Date.now()),
            'codex-hud watch: write error',
          );
        },
      });

      const cleanup = (): void => {
        client.stop();
        process.exit(0);
      };
      process.on('SIGINT', cleanup);
      process.on('SIGTERM', cleanup);

      process.stderr.write('codex-hud watch: connecting to App Server...\n');
      client.start();

      // Prevent Node.js from exiting; WebSocket event listeners keep the loop alive.
      break;
    }

    case '--version':
    case '-v': {
      const { HUD_VERSION } = await import('./state/types.js');
      process.stdout.write(`codex-hud ${HUD_VERSION}\n`);
      break;
    }

    default: {
      const cmd = command ?? '';
      if (cmd) {
        process.stderr.write(`codex-hud: unknown command "${cmd}"\n`);
      }
      process.stderr.write('Usage: codex-hud <command>\n\n');
      process.stderr.write('Commands:\n');
      process.stderr.write('  setup      Configure the visible native Codex status line\n');
      process.stderr.write('  install    Configure hooks for standalone source/npm installs\n');
      process.stderr.write('  uninstall  Remove codex-hud hooks from Codex configuration\n');
      process.stderr.write('  verify     Check installation and show current session state\n');
      process.stderr.write('  watch      Connect to Codex App Server for live telemetry\n');
      process.stderr.write('  hook       Process a Codex lifecycle hook event from stdin\n');
      process.stderr.write('  status     Print the current HUD status line\n');
      process.stderr.write('  --version  Print the HUD version\n');
      process.exitCode = cmd ? 1 : 0;
    }
  }
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  process.stderr.write(`codex-hud: ${msg}\n`);
  process.exitCode = 1;
});
