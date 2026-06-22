import { spawn } from 'node:child_process';
import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import { createInterface } from 'node:readline';
import { HUD_VERSION } from '../../state/types.js';
import type { HudState } from '../../state/types.js';
import type { GetAccountRateLimitsResponse } from './schema.js';

const INITIALIZE_REQUEST_ID = 1;
const RATE_LIMITS_REQUEST_ID = 2;
const DEFAULT_TIMEOUT_MS = 10_000;

export interface RateLimitReaderOptions {
  timeoutMs?: number;
  spawnCodex?: () => ChildProcessWithoutNullStreams;
}

interface StdioResponse {
  id: number;
  result?: unknown;
  error?: { message: string };
}

function parseStdioResponse(line: string): StdioResponse | null {
  try {
    const value = JSON.parse(line) as unknown;
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
    const response = value as Record<string, unknown>;
    if (typeof response['id'] !== 'number') return null;
    const error = response['error'];
    if (error !== undefined) {
      if (typeof error !== 'object' || error === null || Array.isArray(error)) return null;
      const message = (error as Record<string, unknown>)['message'];
      if (typeof message !== 'string') return null;
      return { id: response['id'], error: { message } };
    }
    return { id: response['id'], result: response['result'] };
  } catch {
    return null;
  }
}

function spawnCodexAppServer(): ChildProcessWithoutNullStreams {
  if (process.platform === 'win32') {
    return spawn(
      process.env['ComSpec'] ?? 'cmd.exe',
      ['/d', '/s', '/c', 'codex app-server --stdio'],
      { windowsHide: true },
    );
  }
  return spawn('codex', ['app-server', '--stdio'], { windowsHide: true });
}

export function shouldRefreshRateLimits(state: HudState, now: number): boolean {
  const windows = [state.rateLimits.primary, state.rateLimits.secondary].filter(
    (window) => window !== null,
  );
  if (windows.length === 0) return true;
  return windows.some((window) => window.resetsAt === null || window.resetsAt * 1000 <= now);
}

export function readRateLimitsFromCodex(
  options: RateLimitReaderOptions = {},
): Promise<GetAccountRateLimitsResponse> {
  return new Promise((resolve, reject) => {
    const child = (options.spawnCodex ?? spawnCodexAppServer)();
    child.stderr.resume();
    const lines = createInterface({ input: child.stdout });
    let settled = false;

    const cleanup = (): void => {
      clearTimeout(timer);
      lines.close();
      child.stdin.end();
      child.kill();
    };

    const fail = (error: Error): void => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };

    const succeed = (result: GetAccountRateLimitsResponse): void => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(result);
    };

    const send = (message: object): void => {
      child.stdin.write(`${JSON.stringify(message)}\n`);
    };

    const timer = setTimeout(
      () => fail(new Error('Timed out reading Codex rate limits')),
      options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    );

    child.once('error', (error) => fail(error));
    child.once('exit', (code) => {
      if (!settled)
        fail(new Error(`Codex App Server exited before responding (${code ?? 'signal'})`));
    });

    lines.on('line', (line) => {
      const message = parseStdioResponse(line);
      if (!message) return;

      if (message.error) {
        fail(new Error(message.error.message));
        return;
      }

      if (message.id === INITIALIZE_REQUEST_ID) {
        send({ method: 'initialized' });
        send({
          id: RATE_LIMITS_REQUEST_ID,
          method: 'account/rateLimits/read',
        });
      } else if (message.id === RATE_LIMITS_REQUEST_ID) {
        succeed(message.result as GetAccountRateLimitsResponse);
      }
    });

    send({
      id: INITIALIZE_REQUEST_ID,
      method: 'initialize',
      params: {
        clientInfo: { name: 'codex-hud', title: 'Codex HUD', version: HUD_VERSION },
        capabilities: { experimentalApi: true },
      },
    });
  });
}
