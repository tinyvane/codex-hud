import { describe, it, expect } from 'vitest';
import { reduce } from '../../src/state/reducer.js';
import { INITIAL_STATE } from '../../src/state/types.js';
import type {
  SessionStartPayload,
  PreToolUsePayload,
  PostToolUsePayload,
  StopPayload,
  SubagentStartPayload,
} from '../../src/adapter/hooks/schema.js';

const NOW = 1_700_000_000_000;

const BASE = {
  session_id: 'sess_abc123',
  cwd: '/home/user/project',
  model: 'o3',
  transcript_path: '/home/user/.codex/transcripts/sess_abc123.jsonl',
};

const TURN_BASE = {
  ...BASE,
  turn_id: 'turn_001',
  permission_mode: 'auto',
};

describe('reducer - SessionStart', () => {
  it('sets sessionId, sessionStart and model', () => {
    const payload: SessionStartPayload = {
      ...BASE,
      hook_event_name: 'SessionStart',
      source: 'startup',
    };
    const next = reduce(INITIAL_STATE, payload, NOW);
    expect(next.sessionId).toBe('sess_abc123');
    expect(next.sessionStart).toBe(NOW);
    expect(next.model).toBe('o3');
  });

  it('resets counters and active tool', () => {
    const prior = { ...INITIAL_STATE, turnCount: 5, subagentCount: 2, activeTool: 'Bash' };
    const payload: SessionStartPayload = {
      ...BASE,
      hook_event_name: 'SessionStart',
      source: 'resume',
    };
    const next = reduce(prior, payload, NOW);
    expect(next.turnCount).toBe(0);
    expect(next.subagentCount).toBe(0);
    expect(next.activeTool).toBeNull();
  });

  it('records lastEvent', () => {
    const payload: SessionStartPayload = {
      ...BASE,
      hook_event_name: 'SessionStart',
      source: 'startup',
    };
    const next = reduce(INITIAL_STATE, payload, NOW);
    expect(next.lastEvent).toBe('SessionStart');
  });
});

describe('reducer - SubagentStart', () => {
  it('increments subagentCount', () => {
    const payload: SubagentStartPayload = {
      ...BASE,
      hook_event_name: 'SubagentStart',
      agent_id: 'agent_001',
      agent_type: 'coding',
      turn_id: 'turn_002',
    };
    const next = reduce(INITIAL_STATE, payload, NOW);
    expect(next.subagentCount).toBe(1);
  });

  it('does not reset turnCount', () => {
    const prior = { ...INITIAL_STATE, turnCount: 3 };
    const payload: SubagentStartPayload = {
      ...BASE,
      hook_event_name: 'SubagentStart',
      agent_id: 'agent_001',
      agent_type: 'coding',
      turn_id: 'turn_002',
    };
    const next = reduce(prior, payload, NOW);
    expect(next.turnCount).toBe(3);
  });
});

describe('reducer - PreToolUse', () => {
  it('sets activeTool', () => {
    const payload: PreToolUsePayload = {
      ...TURN_BASE,
      hook_event_name: 'PreToolUse',
      tool_name: 'Bash',
      tool_input: { command: 'ls' },
      tool_use_id: 'tool_001',
    };
    const next = reduce(INITIAL_STATE, payload, NOW);
    expect(next.activeTool).toBe('Bash');
  });
});

describe('reducer - PostToolUse', () => {
  it('clears activeTool and records tool name', () => {
    const prior = { ...INITIAL_STATE, activeTool: 'Bash' };
    const payload: PostToolUsePayload = {
      ...TURN_BASE,
      hook_event_name: 'PostToolUse',
      tool_name: 'Bash',
      tool_input: { command: 'ls' },
      tool_response: { output: '', exit_code: 0 },
    };
    const next = reduce(prior, payload, NOW);
    expect(next.activeTool).toBeNull();
    expect(next.lastToolName).toBe('Bash');
    expect(next.lastToolStatus).toBe('success');
  });

  it('does not increment turnCount', () => {
    const prior = { ...INITIAL_STATE, turnCount: 2 };
    const payload: PostToolUsePayload = {
      ...TURN_BASE,
      hook_event_name: 'PostToolUse',
      tool_name: 'apply_patch',
      tool_input: {},
      tool_response: {},
    };
    const next = reduce(prior, payload, NOW);
    expect(next.turnCount).toBe(2);
  });
});

describe('reducer - Stop', () => {
  it('increments turnCount', () => {
    const prior = { ...INITIAL_STATE, turnCount: 2 };
    const payload: StopPayload = {
      ...TURN_BASE,
      hook_event_name: 'Stop',
      last_assistant_message: 'Done.',
      stop_hook_active: false,
    };
    const next = reduce(prior, payload, NOW);
    expect(next.turnCount).toBe(3);
  });

  it('clears activeTool', () => {
    const prior = { ...INITIAL_STATE, activeTool: 'Bash' };
    const payload: StopPayload = {
      ...TURN_BASE,
      hook_event_name: 'Stop',
      last_assistant_message: 'Done.',
      stop_hook_active: false,
    };
    const next = reduce(prior, payload, NOW);
    expect(next.activeTool).toBeNull();
  });
});

describe('reducer - state immutability', () => {
  it('does not mutate the input state', () => {
    const before = { ...INITIAL_STATE };
    const payload: SessionStartPayload = {
      ...BASE,
      hook_event_name: 'SessionStart',
      source: 'startup',
    };
    reduce(INITIAL_STATE, payload, NOW);
    expect(INITIAL_STATE).toEqual(before);
  });
});
