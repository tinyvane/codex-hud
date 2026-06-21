import { describe, it, expect } from 'vitest';
import { formatDuration, formatTokens } from '../../src/renderer/format.js';

describe('formatDuration', () => {
  it('returns 0s for zero', () => {
    expect(formatDuration(0)).toBe('0s');
  });

  it('returns 0s for negative', () => {
    expect(formatDuration(-100)).toBe('0s');
  });

  it('formats under a minute in seconds', () => {
    expect(formatDuration(5_000)).toBe('5s');
    expect(formatDuration(59_000)).toBe('59s');
  });

  it('formats exactly one minute', () => {
    expect(formatDuration(60_000)).toBe('1m00s');
  });

  it('formats minutes and seconds', () => {
    expect(formatDuration(90_000)).toBe('1m30s');
    expect(formatDuration(3_661_000)).toBe('61m01s');
  });
});

describe('formatTokens', () => {
  it('returns 0 for zero', () => {
    expect(formatTokens(0)).toBe('0');
  });

  it('returns 0 for negative', () => {
    expect(formatTokens(-1)).toBe('0');
  });

  it('formats small counts directly', () => {
    expect(formatTokens(42)).toBe('42');
    expect(formatTokens(999)).toBe('999');
  });

  it('formats thousands with k suffix', () => {
    expect(formatTokens(1_000)).toBe('1.0k');
    expect(formatTokens(12_500)).toBe('12.5k');
    expect(formatTokens(999_999)).toBe('1000.0k');
  });

  it('formats millions with M suffix', () => {
    expect(formatTokens(1_000_000)).toBe('1.00M');
    expect(formatTokens(2_500_000)).toBe('2.50M');
  });
});
