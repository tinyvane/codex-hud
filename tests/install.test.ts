import { describe, it, expect } from 'vitest';
import {
  makeHudMatcherGroup,
  isHudMatcherGroup,
  mergeHudHooks,
  removeHudHooks,
} from '../src/install.js';
import type { HooksConfig, MatcherGroup } from '../src/install.js';

describe('makeHudMatcherGroup', () => {
  it('returns a matcher group with the codex-hud command', () => {
    const group = makeHudMatcherGroup();
    expect(group.hooks).toHaveLength(1);
    expect(group.hooks[0].command).toBe('codex-hud hook');
    expect(group.hooks[0].type).toBe('command');
  });

  it('does not include a matcher field', () => {
    const group = makeHudMatcherGroup();
    expect(group.matcher).toBeUndefined();
  });
});

describe('isHudMatcherGroup', () => {
  it('returns true for a codex-hud group', () => {
    expect(isHudMatcherGroup(makeHudMatcherGroup())).toBe(true);
  });

  it('returns false for an unrelated group', () => {
    const other: MatcherGroup = { hooks: [{ type: 'command', command: 'other-tool' }] };
    expect(isHudMatcherGroup(other)).toBe(false);
  });

  it('returns false for a group with no hooks', () => {
    const empty: MatcherGroup = { hooks: [] };
    expect(isHudMatcherGroup(empty)).toBe(false);
  });
});

describe('mergeHudHooks', () => {
  it('adds hooks for all target events on empty config', () => {
    const { config, added } = mergeHudHooks({});
    expect(added).toContain('SessionStart');
    expect(added).toContain('PreToolUse');
    expect(added).toContain('PostToolUse');
    expect(added).toContain('SubagentStart');
    expect(added).toContain('SubagentStop');
    expect(added).toContain('Stop');
    expect(added).toHaveLength(6);
    expect(config.hooks?.['SessionStart']).toBeDefined();
  });

  it('does not add a hook when it is already present', () => {
    const existing: HooksConfig = {
      hooks: { SessionStart: [makeHudMatcherGroup()] },
    };
    const { added } = mergeHudHooks(existing);
    expect(added).not.toContain('SessionStart');
  });

  it('appends to existing non-hud hooks', () => {
    const other: MatcherGroup = { hooks: [{ type: 'command', command: 'other-hook' }] };
    const existing: HooksConfig = { hooks: { Stop: [other] } };
    const { config } = mergeHudHooks(existing);
    expect(config.hooks?.['Stop']).toHaveLength(2);
    expect(config.hooks?.['Stop']?.[0]).toBe(other);
    expect(isHudMatcherGroup(config.hooks?.['Stop']?.[1] as MatcherGroup)).toBe(true);
  });

  it('preserves unrelated top-level config keys', () => {
    const existing: HooksConfig = { hooks: {}, customKey: 'preserved' };
    const { config } = mergeHudHooks(existing);
    expect(config.customKey).toBe('preserved');
  });

  it('accepts a custom events list', () => {
    const { added } = mergeHudHooks({}, ['Stop']);
    expect(added).toEqual(['Stop']);
  });
});

describe('removeHudHooks', () => {
  it('removes codex-hud hooks from all events', () => {
    const config: HooksConfig = { hooks: { Stop: [makeHudMatcherGroup()] } };
    const { removed } = removeHudHooks(config);
    expect(removed).toContain('Stop');
  });

  it('leaves non-hud hooks in place', () => {
    const other: MatcherGroup = { hooks: [{ type: 'command', command: 'other-hook' }] };
    const config: HooksConfig = { hooks: { Stop: [other, makeHudMatcherGroup()] } };
    const { config: cleaned } = removeHudHooks(config);
    expect(cleaned.hooks?.['Stop']).toHaveLength(1);
    expect(cleaned.hooks?.['Stop']?.[0]).toBe(other);
  });

  it('drops the event key when all groups are removed', () => {
    const config: HooksConfig = { hooks: { Stop: [makeHudMatcherGroup()] } };
    const { config: cleaned } = removeHudHooks(config);
    expect(cleaned.hooks?.['Stop']).toBeUndefined();
  });

  it('returns empty removed list when there are no hud hooks', () => {
    const config: HooksConfig = {
      hooks: { Stop: [{ hooks: [{ type: 'command', command: 'other' }] }] },
    };
    const { removed } = removeHudHooks(config);
    expect(removed).toHaveLength(0);
  });

  it('handles empty config gracefully', () => {
    const { removed, config } = removeHudHooks({});
    expect(removed).toHaveLength(0);
    expect(config).toEqual({});
  });

  it('is idempotent when called twice', () => {
    const config: HooksConfig = { hooks: { Stop: [makeHudMatcherGroup()] } };
    const { config: once } = removeHudHooks(config);
    const { config: twice, removed } = removeHudHooks(once);
    expect(removed).toHaveLength(0);
    expect(twice.hooks?.['Stop']).toBeUndefined();
  });
});
