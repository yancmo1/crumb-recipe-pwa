import { describe, expect, it } from 'vitest';
import { extractDurationsFromInstruction } from './stepTimers';

describe('extractDurationsFromInstruction', () => {
  it('extracts minutes from common phrasing', () => {
    const step = 'Cover and let rest for 30 minutes.';
    const res = extractDurationsFromInstruction(step);
    expect(res).toHaveLength(1);
    expect(res[0].seconds).toBe(30 * 60);
  });

  it('combines hours + minutes into one duration', () => {
    const step = 'Bake for 1 hour and 15 minutes, then cool.';
    const res = extractDurationsFromInstruction(step);
    expect(res).toHaveLength(1);
    expect(res[0].seconds).toBe(1 * 3600 + 15 * 60);
  });

  it('does not match bare numbers (step numbers)', () => {
    const step = '5';
    const res = extractDurationsFromInstruction(step);
    expect(res).toHaveLength(0);
  });

  it('extracts multiple durations when separated', () => {
    const step = 'Rest 10 minutes. Then bake 20 minutes.';
    const res = extractDurationsFromInstruction(step);
    expect(res).toHaveLength(2);
    expect(res[0].seconds).toBe(10 * 60);
    expect(res[1].seconds).toBe(20 * 60);
  });
});
