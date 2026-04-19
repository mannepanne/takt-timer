import { describe, expect, it } from 'vitest';

import { fmtTime } from './format';

describe('fmtTime', () => {
  it('formats seconds as M:SS with zero-padded seconds', () => {
    expect(fmtTime(0)).toBe('0:00');
    expect(fmtTime(5)).toBe('0:05');
    expect(fmtTime(60)).toBe('1:00');
    expect(fmtTime(95)).toBe('1:35');
    expect(fmtTime(3600)).toBe('60:00');
  });

  it('clamps negatives to 0', () => {
    expect(fmtTime(-5)).toBe('0:00');
  });

  it('floors fractional seconds', () => {
    expect(fmtTime(59.9)).toBe('0:59');
  });
});
