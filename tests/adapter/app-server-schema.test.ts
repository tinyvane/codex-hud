import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseMessage, isNotification, isResponse } from '../../src/adapter/app-server/schema.js';
import type { JsonRpcNotification } from '../../src/adapter/app-server/schema.js';

const FIXTURES = join(import.meta.dirname, '../fixtures/app-server');

function fixture(name: string): string {
  return readFileSync(join(FIXTURES, name), 'utf8');
}

describe('parseMessage', () => {
  it('parses a valid notification', () => {
    const msg = parseMessage(fixture('token-usage-updated.json'));
    expect(msg).not.toBeNull();
    expect(isNotification(msg!)).toBe(true);
    expect((msg as JsonRpcNotification).method).toBe('thread/tokenUsage/updated');
  });

  it('parses a valid JSON-RPC response', () => {
    const raw = JSON.stringify({ jsonrpc: '2.0', id: 1, result: { userAgent: 'codex/1.0' } });
    const msg = parseMessage(raw);
    expect(msg).not.toBeNull();
  });

  it('returns null for invalid JSON', () => {
    expect(parseMessage('not json')).toBeNull();
  });

  it('returns null for a JSON array', () => {
    expect(parseMessage('[]')).toBeNull();
  });

  it('returns null for wrong jsonrpc version', () => {
    const raw = JSON.stringify({ jsonrpc: '1.0', method: 'foo' });
    expect(parseMessage(raw)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseMessage('')).toBeNull();
  });

  it('returns null for JSON null', () => {
    expect(parseMessage('null')).toBeNull();
  });
});

describe('Codex 0.141.0 generated rate-limit schema', () => {
  it('defines reset timestamps as nullable int64 values', () => {
    const path = join(
      import.meta.dirname,
      '../../schemas/app-server/0.141.0/GetAccountRateLimitsResponse.json',
    );
    const schema = JSON.parse(readFileSync(path, 'utf8')) as {
      definitions: {
        RateLimitWindow: { properties: { resetsAt: { format: string; type: string[] } } };
      };
    };

    expect(schema.definitions.RateLimitWindow.properties.resetsAt).toEqual({
      type: ['integer', 'null'],
      format: 'int64',
    });
  });
});

describe('isNotification', () => {
  it('returns true for a notification (method, no id)', () => {
    const msg = parseMessage(fixture('turn-started.json'))!;
    expect(isNotification(msg)).toBe(true);
  });

  it('returns false for a response (id, no method)', () => {
    const raw = JSON.stringify({ jsonrpc: '2.0', id: 1, result: {} });
    const msg = parseMessage(raw)!;
    expect(isNotification(msg)).toBe(false);
  });
});

describe('isResponse', () => {
  it('returns true for a response', () => {
    const raw = JSON.stringify({ jsonrpc: '2.0', id: 1, result: {} });
    const msg = parseMessage(raw)!;
    expect(isResponse(msg)).toBe(true);
  });

  it('returns false for a notification', () => {
    const msg = parseMessage(fixture('turn-started.json'))!;
    expect(isResponse(msg)).toBe(false);
  });
});
