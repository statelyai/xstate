import { mulberry32 } from './generate.ts';

/** `Date.now()` at simulated time 0. */
const EPOCH = 1_700_000_000_000;

/**
 * Runs `fn` with `Date.now`, `performance.now`, and `Math.random` driven by
 * the simulated clock and a seeded generator, so both majors read identical
 * values. The originals are restored afterwards.
 */
export async function withDeterminism<T>(
  clock: { now(): number },
  seed: number,
  fn: () => T | Promise<T>
): Promise<T> {
  const { now } = Date;
  const perfNow = performance.now;
  const { random } = Math;
  Date.now = () => EPOCH + clock.now();
  performance.now = () => clock.now();
  Math.random = mulberry32(seed);
  try {
    return await fn();
  } finally {
    Date.now = now;
    performance.now = perfNow;
    Math.random = random;
  }
}
