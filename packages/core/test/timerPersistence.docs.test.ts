import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createActor, createMachine, SimulatedClock } from '../src/index.ts';
import { restoreActor } from '../src/persist/index.ts';
import { resumeDeadline } from './fixtures/timer-persistence/deadline.ts';
import { restartDelay } from './fixtures/timer-persistence/restart.ts';
import { resumeRemaining } from './fixtures/timer-persistence/pause.ts';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1_000_000);
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

it.each([
  ['deadline', resumeDeadline, 3_000],
  ['restart', restartDelay, 10_000],
  ['pause', resumeRemaining, 6_000]
] as const)(
  'runs the documented %s policy on the default clock',
  async (name, run, remaining) => {
    const docs = readFileSync(
      resolve(__dirname, '../../../docs/persistence.md'),
      'utf8'
    );
    const source = readFileSync(
      resolve(__dirname, `fixtures/timer-persistence/${name}.ts`),
      'utf8'
    );
    expect(docs).toContain('```ts\n' + source.trimEnd() + '\n```');

    const result = run();
    await vi.advanceTimersByTimeAsync(7_000);
    const restored = await result;
    expect(restored.getSnapshot().value).toBe(
      name === 'pause' ? 'running' : 'waiting'
    );
    if (name === 'pause') {
      expect(restored.getSnapshot().context).toMatchObject({
        remainingMs: 6_000
      });
    }
    await vi.advanceTimersByTimeAsync(remaining - 1);
    expect(restored.getSnapshot().status).toBe('active');
    await vi.advanceTimersByTimeAsync(1);
    expect(restored.getSnapshot().value).toBe('done');
    restored.stop();
  }
);

const timedMachine = createMachine({
  initial: 'waiting',
  states: {
    waiting: {
      after: { 10_000: { target: 'done' } },
      on: { restart: { target: 'waiting', reenter: true } }
    },
    done: { type: 'final' }
  }
});

it.each([false, true])(
  'restores an overdue timer asynchronously (restart: %s)',
  (restart) => {
    const actor = createActor(timedMachine).start();
    vi.advanceTimersByTime(4_000);
    const stored = JSON.stringify(actor.getPersistedSnapshot());
    actor.stop();
    vi.advanceTimersByTime(20_000);
    const restored = restoreActor(timedMachine, JSON.parse(stored)).start();
    expect(restored.getSnapshot().value).toBe('waiting');
    if (restart) restored.send({ type: 'restart' });
    vi.advanceTimersByTime(0);
    expect(restored.getSnapshot().value).toBe(restart ? 'waiting' : 'done');
    if (restart) {
      vi.advanceTimersByTime(9_999);
      expect(restored.getSnapshot().value).toBe('waiting');
      vi.advanceTimersByTime(1);
      expect(restored.getSnapshot().value).toBe('done');
    }
    restored.stop();
  }
);

it('restarts the full delay with a clock exposing now(), even with the same origin', () => {
  const clock = new SimulatedClock();
  const actor = createActor(timedMachine, { clock }).start();
  clock.increment(4_000);
  const stored = JSON.stringify(actor.getPersistedSnapshot());
  actor.stop();
  clock.increment(3_000);
  const restored = restoreActor(timedMachine, JSON.parse(stored), {
    clock
  }).start();
  clock.increment(9_999);
  expect(restored.getSnapshot().value).toBe('waiting');
  clock.increment(1);
  expect(restored.getSnapshot().value).toBe('done');
  restored.stop();
});
