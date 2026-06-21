import { describe, it, expect } from 'vitest';
import { renderStatusLine } from '../../src/renderer/status-line.js';
import { HUD_VERSION, INITIAL_STATE } from '../../src/state/types.js';

const NOW = 1_700_000_000_000;

describe('renderStatusLine', () => {
  it('always includes the HUD version', () => {
    const line = renderStatusLine(INITIAL_STATE, NOW);
    expect(line).toContain(`v${HUD_VERSION}`);
  });

  it('includes model name when set', () => {
    const state = { ...INITIAL_STATE, model: 'o3' };
    const line = renderStatusLine(state, NOW);
    expect(line).toContain('o3');
  });

  it('includes duration when session is active', () => {
    const state = { ...INITIAL_STATE, sessionStart: NOW - 65_000 };
    const line = renderStatusLine(state, NOW);
    expect(line).toContain('1m05s');
  });

  it('shows active tool with > prefix', () => {
    const state = { ...INITIAL_STATE, activeTool: 'Bash' };
    const line = renderStatusLine(state, NOW);
    expect(line).toContain('> Bash');
  });

  it('shows last tool name after tool completes', () => {
    const state = {
      ...INITIAL_STATE,
      lastToolName: 'apply_patch',
      lastToolStatus: 'success' as const,
    };
    const line = renderStatusLine(state, NOW);
    expect(line).toContain('apply_patch');
  });

  it('shows + icon on success', () => {
    const state = { ...INITIAL_STATE, lastToolName: 'Bash', lastToolStatus: 'success' as const };
    const line = renderStatusLine(state, NOW);
    expect(line).toContain('+');
  });

  it('shows x icon on error', () => {
    const state = { ...INITIAL_STATE, lastToolName: 'Bash', lastToolStatus: 'error' as const };
    const line = renderStatusLine(state, NOW);
    expect(line).toContain('x');
  });

  it('shows turn count when > 0', () => {
    const state = { ...INITIAL_STATE, turnCount: 3 };
    const line = renderStatusLine(state, NOW);
    expect(line).toContain('turns:3');
  });

  it('shows agent count when > 0', () => {
    const state = { ...INITIAL_STATE, subagentCount: 2 };
    const line = renderStatusLine(state, NOW);
    expect(line).toContain('agents:2');
  });

  it('omits token display when tokens are zero', () => {
    const line = renderStatusLine(INITIAL_STATE, NOW);
    expect(line).not.toContain('tok:');
  });

  it('shows token total when non-zero', () => {
    const state = {
      ...INITIAL_STATE,
      tokens: { inputUsed: 1_200, outputUsed: 300, contextLimit: null },
    };
    const line = renderStatusLine(state, NOW);
    expect(line).toContain('tok:1.5k');
  });

  it('sanitizes malicious ANSI in model name', () => {
    const state = { ...INITIAL_STATE, model: 'o3\x1b[31m-evil' };
    const line = renderStatusLine(state, NOW);
    expect(line).not.toContain('\x1b[31m-evil');
    expect(line).toContain('o3-evil');
  });

  it('sanitizes control chars in tool name', () => {
    const state = { ...INITIAL_STATE, activeTool: 'Bash\x00inject' };
    const line = renderStatusLine(state, NOW);
    expect(line).not.toContain('\x00');
    expect(line).toContain('Bashinject');
  });

  it('shows git branch with @ prefix', () => {
    const state = { ...INITIAL_STATE, gitBranch: 'main' };
    const line = renderStatusLine(state, NOW);
    expect(line).toContain('@main');
  });

  it('sanitizes git branch name', () => {
    const state = { ...INITIAL_STATE, gitBranch: 'feat\x1b[31mhack' };
    const line = renderStatusLine(state, NOW);
    expect(line).not.toContain('\x1b[31m');
    expect(line).toContain('@feathack');
  });

  it('omits git branch section when null', () => {
    const line = renderStatusLine(INITIAL_STATE, NOW);
    expect(line).not.toContain('@');
  });

  it('ends with ANSI reset', () => {
    const line = renderStatusLine(INITIAL_STATE, NOW);
    expect(line.endsWith('\x1b[0m')).toBe(true);
  });
});
