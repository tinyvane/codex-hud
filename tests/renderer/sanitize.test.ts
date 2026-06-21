import { describe, it, expect } from 'vitest';
import { sanitize, withReset } from '../../src/renderer/sanitize.js';

describe('sanitize', () => {
  it('passes through plain ASCII', () => {
    expect(sanitize('hello world')).toBe('hello world');
  });

  it('passes through Unicode', () => {
    expect(sanitize('café resume')).toBe('café resume');
  });

  it('strips ANSI CSI sequences', () => {
    expect(sanitize('\x1b[31mred\x1b[0m')).toBe('red');
  });

  it('strips ANSI cursor sequences', () => {
    expect(sanitize('\x1b[2Aup')).toBe('up');
  });

  it('strips C0 NUL and BEL', () => {
    expect(sanitize('a\x00b\x07c')).toBe('abc');
  });

  it('strips DEL (0x7f)', () => {
    expect(sanitize('a\x7fb')).toBe('ab');
  });

  it('preserves newline (0x0a)', () => {
    expect(sanitize('a\nb')).toBe('a\nb');
  });

  it('preserves tab (0x09)', () => {
    expect(sanitize('a\tb')).toBe('a\tb');
  });

  it('strips injected ANSI from model name', () => {
    const malicious = 'o3\x1b[31m-evil\x1b[0m';
    expect(sanitize(malicious)).toBe('o3-evil');
  });

  it('handles empty string', () => {
    expect(sanitize('')).toBe('');
  });
});

describe('withReset', () => {
  it('appends full ANSI reset', () => {
    expect(withReset('text')).toBe('text\x1b[0m');
  });

  it('appends reset to empty string', () => {
    expect(withReset('')).toBe('\x1b[0m');
  });
});
