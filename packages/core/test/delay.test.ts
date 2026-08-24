import { parseDurationToMilliseconds } from '../src/delay.ts';

describe('parseDurationToMilliseconds', () => {
  it.each([
    ['s', 0],
    ['.s', 0],
    ['.5s', 500],
    ['5.s', 5_000],
    ['1.2345s', 1_234]
  ])('parses second duration %s', (duration, expected) => {
    expect(parseDurationToMilliseconds(duration)).toBe(expected);
  });
});
