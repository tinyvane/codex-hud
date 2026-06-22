import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';
import {
  readRateLimitsFromCodex,
  shouldRefreshRateLimits,
} from '../../src/adapter/app-server/rate-limits.js';
import { INITIAL_STATE } from '../../src/state/types.js';
import type { ChildProcessWithoutNullStreams } from 'node:child_process';

function createFakeAppServer(): {
  child: ChildProcessWithoutNullStreams;
  requests: Array<Record<string, unknown>>;
} {
  const stdin = new PassThrough();
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  const requests: Array<Record<string, unknown>> = [];
  const emitter = new EventEmitter();
  const child = Object.assign(emitter, {
    stdin,
    stdout,
    stderr,
    kill: vi.fn(() => true),
  }) as unknown as ChildProcessWithoutNullStreams;

  let input = '';
  stdin.on('data', (chunk: Buffer) => {
    input += chunk.toString('utf8');
    while (input.includes('\n')) {
      const newline = input.indexOf('\n');
      const line = input.slice(0, newline);
      input = input.slice(newline + 1);
      const request = JSON.parse(line) as Record<string, unknown>;
      requests.push(request);

      if (request['id'] === 1) {
        stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id: 1, result: {} })}\n`);
      } else if (request['id'] === 2) {
        stdout.write(
          `${JSON.stringify({
            jsonrpc: '2.0',
            id: 2,
            result: {
              rateLimits: {
                primary: { usedPercent: 92, windowDurationMins: 300, resetsAt: 1700003600 },
                secondary: {
                  usedPercent: 82,
                  windowDurationMins: 10080,
                  resetsAt: 1700604800,
                },
              },
            },
          })}\n`,
        );
      }
    }
  });

  return { child, requests };
}

describe('readRateLimitsFromCodex', () => {
  it('initializes App Server and requests the structured rate-limit snapshot', async () => {
    const server = createFakeAppServer();
    const result = await readRateLimitsFromCodex({
      spawnCodex: () => server.child,
      timeoutMs: 1_000,
    });

    expect(server.requests.map((request) => request['method'])).toEqual([
      'initialize',
      'initialized',
      'account/rateLimits/read',
    ]);
    expect(result.rateLimits.primary?.resetsAt).toBe(1700003600);
    expect(result.rateLimits.secondary?.resetsAt).toBe(1700604800);
    expect(server.child.kill).toHaveBeenCalled();
  });
});

describe('shouldRefreshRateLimits', () => {
  it('refreshes when no snapshot has been cached', () => {
    expect(shouldRefreshRateLimits(INITIAL_STATE, 1_700_000_000_000)).toBe(true);
  });

  it('reuses a snapshot while every known window is current', () => {
    const state = {
      ...INITIAL_STATE,
      rateLimits: {
        primary: { usedPercent: 92, windowDurationMins: 300, resetsAt: 1700003600 },
        secondary: { usedPercent: 82, windowDurationMins: 10080, resetsAt: 1700604800 },
      },
    };
    expect(shouldRefreshRateLimits(state, 1_700_000_000_000)).toBe(false);
  });

  it('refreshes after either known window expires', () => {
    const state = {
      ...INITIAL_STATE,
      rateLimits: {
        primary: { usedPercent: 100, windowDurationMins: 300, resetsAt: 1700000000 },
        secondary: { usedPercent: 82, windowDurationMins: 10080, resetsAt: 1700604800 },
      },
    };
    expect(shouldRefreshRateLimits(state, 1_700_000_000_000)).toBe(true);
  });
});
