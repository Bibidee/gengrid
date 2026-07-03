import { describe, it, expect } from 'vitest';
import { computeClockOffsetMs, correctedNowMs, remainingMs } from '../clock';

describe('computeClockOffsetMs', () => {
  it('is positive when the device clock is behind the server', () => {
    const local = new Date('2026-07-03T12:00:00Z').getTime();
    expect(computeClockOffsetMs('2026-07-03T12:00:30Z', local)).toBe(30_000);
  });

  it('is negative when the device clock is ahead of the server', () => {
    // The playtest bug: device clock ~84s fast showed 1:24 remaining after
    // the round had actually ended.
    const local = new Date('2026-07-03T12:01:24Z').getTime();
    expect(computeClockOffsetMs('2026-07-03T12:00:00Z', local)).toBe(-84_000);
  });

  it('returns 0 for missing or malformed server_now', () => {
    expect(computeClockOffsetMs(null, 123)).toBe(0);
    expect(computeClockOffsetMs(undefined, 123)).toBe(0);
    expect(computeClockOffsetMs('not-a-date', 123)).toBe(0);
  });
});

describe('remainingMs', () => {
  const endsAt = '2026-07-03T12:05:00Z';

  it('corrects a fast device clock so the countdown matches the server', () => {
    // Server says 12:04:00 (60s left). Device thinks it is 12:05:30.
    const local = new Date('2026-07-03T12:05:30Z').getTime();
    const offset = computeClockOffsetMs('2026-07-03T12:04:00Z', local);
    expect(remainingMs(endsAt, offset, local)).toBe(60_000);
    // Uncorrected, the same device would (wrongly) think time was up.
    expect(remainingMs(endsAt, 0, local)).toBe(-30_000);
  });

  it('corrects a slow device clock (would otherwise show extra time)', () => {
    // Server says 12:05:10 (ended 10s ago). Device thinks it is 12:03:46,
    // i.e. would show 1:14 remaining without correction.
    const local = new Date('2026-07-03T12:03:46Z').getTime();
    const offset = computeClockOffsetMs('2026-07-03T12:05:10Z', local);
    expect(remainingMs(endsAt, offset, local)).toBe(-10_000);
    expect(remainingMs(endsAt, 0, local)).toBe(74_000);
  });

  it('correctedNowMs adds the offset to the local clock', () => {
    expect(correctedNowMs(5_000, 100)).toBe(5_100);
  });
});
