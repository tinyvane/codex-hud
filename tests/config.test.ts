import { describe, expect, it } from 'vitest';
import {
  HUD_STATUS_LINE,
  hasHudStatusLine,
  mergeHudStatusLine,
  type CodexConfig,
} from '../src/config/codex.js';

describe('native Codex HUD status line', () => {
  it('includes context and account usage remaining fields', () => {
    expect(HUD_STATUS_LINE).toContain('context-remaining');
    expect(HUD_STATUS_LINE).toContain('five-hour-limit');
    expect(HUD_STATUS_LINE).toContain('weekly-limit');
  });

  it('adds the recommended fields without discarding existing TUI configuration', () => {
    const original: CodexConfig = {
      tui: { notifications: false, status_line: ['current-dir'] },
      model: 'gpt-5',
    };

    const result = mergeHudStatusLine(original);

    expect(result.changed).toBe(true);
    expect(result.config.tui).toEqual({
      notifications: false,
      status_line: ['current-dir', ...HUD_STATUS_LINE],
    });
    expect(result.config.model).toBe('gpt-5');
    expect(original.tui?.status_line).toEqual(['current-dir']);
  });

  it('is idempotent', () => {
    const once = mergeHudStatusLine({});
    const twice = mergeHudStatusLine(once.config);

    expect(once.changed).toBe(true);
    expect(twice.changed).toBe(false);
    expect(twice.config).toEqual(once.config);
    expect(hasHudStatusLine(twice.config)).toBe(true);
  });

  it('treats a partial configuration as not configured', () => {
    expect(hasHudStatusLine({ tui: { status_line: ['model-with-reasoning'] } })).toBe(false);
  });
});
