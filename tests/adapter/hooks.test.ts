import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseHookPayload } from '../../src/adapter/hooks/handler.js';

const FIXTURES_DIR = join(import.meta.dirname, '../fixtures/hooks');

function loadFixture(name: string): string {
  return readFileSync(join(FIXTURES_DIR, name), 'utf8');
}

describe('parseHookPayload - valid inputs', () => {
  it('parses SessionStart fixture', () => {
    const payload = parseHookPayload(loadFixture('session-start.json'));
    expect(payload.hook_event_name).toBe('SessionStart');
    expect(payload.session_id).toBe('sess_abc123');
    expect(payload.model).toBe('o3');
  });

  it('parses PreToolUse fixture', () => {
    const payload = parseHookPayload(loadFixture('pre-tool-use.json'));
    expect(payload.hook_event_name).toBe('PreToolUse');
  });

  it('parses PostToolUse fixture', () => {
    const payload = parseHookPayload(loadFixture('post-tool-use.json'));
    expect(payload.hook_event_name).toBe('PostToolUse');
  });

  it('parses Stop fixture', () => {
    const payload = parseHookPayload(loadFixture('stop.json'));
    expect(payload.hook_event_name).toBe('Stop');
  });

  it('parses SubagentStart fixture', () => {
    const payload = parseHookPayload(loadFixture('subagent-start.json'));
    expect(payload.hook_event_name).toBe('SubagentStart');
  });
});

describe('parseHookPayload - malformed inputs', () => {
  it('throws SyntaxError on invalid JSON', () => {
    expect(() => parseHookPayload('not json')).toThrow(SyntaxError);
  });

  it('throws SyntaxError on truncated JSON', () => {
    expect(() => parseHookPayload('{"session_id":')).toThrow(SyntaxError);
  });

  it('throws TypeError on JSON null', () => {
    expect(() => parseHookPayload('null')).toThrow(TypeError);
  });

  it('throws TypeError on JSON array', () => {
    expect(() => parseHookPayload('[]')).toThrow(TypeError);
  });

  it('throws TypeError on JSON string', () => {
    expect(() => parseHookPayload('"hello"')).toThrow(TypeError);
  });

  it('throws TypeError when hook_event_name is missing', () => {
    expect(() => parseHookPayload(JSON.stringify({ session_id: 'x', cwd: '/tmp' }))).toThrow(
      TypeError,
    );
  });

  it('throws TypeError when hook_event_name is a number', () => {
    expect(() =>
      parseHookPayload(JSON.stringify({ session_id: 'x', hook_event_name: 42 })),
    ).toThrow(TypeError);
  });

  it('throws TypeError when session_id is missing', () => {
    expect(() =>
      parseHookPayload(JSON.stringify({ hook_event_name: 'Stop', cwd: '/tmp' })),
    ).toThrow(TypeError);
  });

  it('throws SyntaxError on empty string', () => {
    expect(() => parseHookPayload('')).toThrow(SyntaxError);
  });
});
