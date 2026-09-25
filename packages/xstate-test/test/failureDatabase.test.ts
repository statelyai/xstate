import * as fc from 'fast-check';
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createMachine, types } from 'xstate';
import {
  ModelTestFailure,
  createFailureDatabase,
  propertyTest,
  testPaths,
  type TestSut
} from '../src/index.ts';

const counterMachine = createMachine({
  id: 'counter',
  schemas: {
    context: types<{ count: number }>(),
    events: { INC: types<{}>(), RESET: types<{}>() }
  },
  context: { count: 0 },
  on: {
    INC: ({ context }) => ({ context: { count: context.count + 1 } }),
    RESET: () => ({ context: { count: 0 } })
  }
});

type CounterSnapshot = ReturnType<typeof counterMachine.getInitialSnapshot>;
type CounterEvent = { type: 'INC' } | { type: 'RESET' };

/** A counter that stops counting at 2 when `buggy` is set. */
function counterSut(
  buggy: () => boolean
): TestSut<CounterSnapshot, CounterEvent> {
  return {
    create: () => {
      let count = 0;
      return {
        send: (event) => {
          if (event.type === 'RESET') {
            count = 0;
          } else if (!(buggy() && count >= 2)) {
            count++;
          }
        },
        read: () => count
      };
    },
    projectModel: (snapshot) => snapshot.context.count
  };
}

const events = { INC: fc.constant({}), RESET: fc.constant({}) };

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'xstate-test-failures-'));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

async function catchFailure(run: () => Promise<unknown>) {
  try {
    await run();
  } catch (error) {
    return error as ModelTestFailure;
  }
  throw new Error('Expected the campaign to fail');
}

describe('failures', () => {
  it('saves a failing fixture, replays it first, and forgets it once fixed', async () => {
    let buggy = true;
    const runs: number[] = [];
    const options = {
      seed: 1,
      numRuns: 50,
      maxCommands: 6,
      events,
      sut: counterSut(() => buggy),
      failures: { dir, key: 'counter' },
      collect: (_trace: unknown, { runIndex }: { runIndex: number }) => {
        runs.push(runIndex);
      }
    };

    const first = await catchFailure(() =>
      propertyTest(counterMachine, options)
    );
    expect(first).toBeInstanceOf(ModelTestFailure);
    const saved = readdirSync(join(dir, 'counter'));
    expect(saved).toHaveLength(1);
    const location = join(dir, 'counter', saved[0]);
    expect(first.message).toContain(`Saved: ${location}`);
    const file = JSON.parse(readFileSync(location, 'utf8'));
    expect(file).toMatchObject({
      formatVersion: 1,
      key: 'counter',
      summary: 'Property observation diverged',
      replay: { engine: 'fast-check', seed: 1 },
      fixture: { formatVersion: 2, machine: { id: 'counter' } }
    });

    runs.length = 0;
    const replayed = await catchFailure(() =>
      propertyTest(counterMachine, options)
    );
    expect(replayed.summary).toBe(
      `Property observation diverged (replayed from ${location})`
    );
    // The stored fixture failed before any generated run started.
    expect(runs).toEqual([]);

    buggy = false;
    await propertyTest(counterMachine, options);
    expect(existsSync(location)).toBe(false);
    expect(runs.length).toBeGreaterThan(0);
  });

  it("skips the campaign with replay: 'only'", async () => {
    const { coverage } = await propertyTest(counterMachine, {
      events,
      sut: counterSut(() => true),
      failures: { dir, key: 'counter', replay: 'only' }
    });
    expect(coverage.runs).toBe(0);
    expect(coverage.exploration.stoppedBecause).toBe('replay');
  });

  it('saves without replaying with replay: false', async () => {
    const options = {
      seed: 1,
      numRuns: 50,
      maxCommands: 6,
      events,
      sut: counterSut(() => true),
      failures: { dir, key: 'counter', replay: false as const }
    };
    await catchFailure(() => propertyTest(counterMachine, options));
    const second = await catchFailure(() =>
      propertyTest(counterMachine, options)
    );
    expect(second.summary).not.toContain('replayed from');
  });

  it('defaults the key to the machine id and a hash of the options', async () => {
    const failure = await catchFailure(() =>
      propertyTest(counterMachine, {
        seed: 1,
        numRuns: 50,
        maxCommands: 6,
        events,
        sut: counterSut(() => true),
        failures: { dir }
      })
    );
    const [key] = readdirSync(dir);
    expect(key).toMatch(/^counter-[0-9a-f]{8}$/);
    expect(failure.message).toContain(`Saved: ${join(dir, key)}`);
  });

  it('works with testPaths()', async () => {
    const options = {
      events,
      sut: counterSut(() => true),
      stopWhen: (snapshot: CounterSnapshot) => snapshot.context.count >= 3,
      failures: createFailureDatabase({ dir, key: 'paths' })
    };
    const first = await catchFailure(() => testPaths(counterMachine, options));
    expect(first.summary).toMatch(/^Path \d+ \(.*\) failed/);
    expect(first.message).toContain(`Saved: ${join(dir, 'paths')}`);

    const replayed = await catchFailure(() =>
      testPaths(counterMachine, options)
    );
    expect(replayed.summary).toMatch(/\(replayed from .*paths/);
  });
});
