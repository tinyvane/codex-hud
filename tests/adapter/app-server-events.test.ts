import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { applyNotification } from '../../src/adapter/app-server/events.js';
import { parseMessage, isNotification } from '../../src/adapter/app-server/schema.js';
import { INITIAL_STATE } from '../../src/state/types.js';
import type { JsonRpcNotification } from '../../src/adapter/app-server/schema.js';

const FIXTURES = join(import.meta.dirname, '../fixtures/app-server');
const NOW = 1_700_000_000_000;

function loadNotification(name: string): JsonRpcNotification {
  const raw = readFileSync(join(FIXTURES, name), 'utf8');
  const msg = parseMessage(raw);
  if (!msg || !isNotification(msg)) throw new Error(`${name} is not a notification`);
  return msg;
}

describe('applyNotification - thread/tokenUsage/updated', () => {
  it('updates token counts from fixture', () => {
    const n = loadNotification('token-usage-updated.json');
    const next = applyNotification(INITIAL_STATE, n, NOW);
    expect(next.tokens.inputUsed).toBe(1200);
    expect(next.tokens.outputUsed).toBe(300);
    expect(next.tokens.contextLimit).toBe(128000);
  });

  it('preserves fields not in the payload', () => {
    const state = { ...INITIAL_STATE, model: 'o3' };
    const n = loadNotification('token-usage-updated.json');
    const next = applyNotification(state, n, NOW);
    expect(next.model).toBe('o3');
  });

  it('retains existing contextLimit when not provided', () => {
    const state = {
      ...INITIAL_STATE,
      tokens: { inputUsed: 0, outputUsed: 0, contextLimit: 64000 },
    };
    const n: JsonRpcNotification = {
      jsonrpc: '2.0',
      method: 'thread/tokenUsage/updated',
      params: { usage: { inputTokens: 100, outputTokens: 50 } },
    };
    const next = applyNotification(state, n, NOW);
    expect(next.tokens.contextLimit).toBe(64000);
  });
});

describe('applyNotification - turn/completed', () => {
  it('increments turnCount and clears activeTool', () => {
    const state = { ...INITIAL_STATE, turnCount: 2, activeTool: 'read_file' };
    const n = loadNotification('turn-completed.json');
    const next = applyNotification(state, n, NOW);
    expect(next.turnCount).toBe(3);
    expect(next.activeTool).toBeNull();
  });

  it('absorbs tokenUsage from turn/completed payload', () => {
    const n = loadNotification('turn-completed.json');
    const next = applyNotification(INITIAL_STATE, n, NOW);
    expect(next.tokens.inputUsed).toBe(1500);
    expect(next.tokens.outputUsed).toBe(450);
  });
});

describe('applyNotification - turn/started', () => {
  it('updates lastUpdated and does not reset turnCount', () => {
    const state = { ...INITIAL_STATE, turnCount: 5 };
    const n = loadNotification('turn-started.json');
    const next = applyNotification(state, n, NOW);
    expect(next.turnCount).toBe(5);
    expect(next.lastUpdated).toBe(NOW);
  });
});

describe('applyNotification - item/started', () => {
  it('sets activeTool for toolCall type', () => {
    const n = loadNotification('item-started-tool.json');
    const next = applyNotification(INITIAL_STATE, n, NOW);
    expect(next.activeTool).toBe('read_file');
  });

  it('sets activeTool for commandExecution type', () => {
    const n = loadNotification('item-started-command.json');
    const next = applyNotification(INITIAL_STATE, n, NOW);
    expect(next.activeTool).toBe('Bash');
  });

  it('does not set activeTool for agentMessage type', () => {
    const n: JsonRpcNotification = {
      jsonrpc: '2.0',
      method: 'item/started',
      params: { item: { id: 'x', type: 'agentMessage', status: 'inProgress' } },
    };
    const next = applyNotification(INITIAL_STATE, n, NOW);
    expect(next.activeTool).toBeNull();
  });
});

describe('applyNotification - item/completed', () => {
  it('clears activeTool and records success', () => {
    const state = { ...INITIAL_STATE, activeTool: 'read_file' };
    const n = loadNotification('item-completed-tool.json');
    const next = applyNotification(state, n, NOW);
    expect(next.activeTool).toBeNull();
    expect(next.lastToolName).toBe('read_file');
    expect(next.lastToolStatus).toBe('success');
  });

  it('records error status for failed items', () => {
    const n: JsonRpcNotification = {
      jsonrpc: '2.0',
      method: 'item/completed',
      params: { item: { id: 'x', type: 'toolCall', status: 'failed', tool: 'write_file' } },
    };
    const next = applyNotification(INITIAL_STATE, n, NOW);
    expect(next.lastToolStatus).toBe('error');
    expect(next.lastToolName).toBe('write_file');
  });
});

describe('applyNotification - unknown method', () => {
  it('returns the same state reference for unknown methods', () => {
    const n: JsonRpcNotification = {
      jsonrpc: '2.0',
      method: 'thread/closed',
      params: { threadId: 'x' },
    };
    const next = applyNotification(INITIAL_STATE, n, NOW);
    expect(next).toBe(INITIAL_STATE);
  });
});

describe('applyNotification - state immutability', () => {
  it('does not mutate the input state', () => {
    const state = { ...INITIAL_STATE, turnCount: 1 };
    const frozen = Object.freeze({ ...state });
    const n = loadNotification('turn-completed.json');
    expect(() => applyNotification(frozen as typeof state, n, NOW)).not.toThrow();
    expect(state.turnCount).toBe(1);
  });
});
