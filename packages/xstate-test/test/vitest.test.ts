import * as fc from 'fast-check';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createMachine, types } from 'xstate';
import type { TestSut } from '../src/index.ts';
import {
  it as modelIt,
  test as modelTest,
  withModelTests
} from '../src/vitest.ts';

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

function counterSut(buggy: boolean): TestSut<CounterSnapshot, CounterEvent> {
  return {
    create: () => {
      let count = 0;
      return {
        send: (event) => {
          count =
            event.type === 'RESET' || (buggy && count >= 2) ? 0 : count + 1;
        },
        read: () => count
      };
    },
    projectModel: (snapshot) => snapshot.context.count
  };
}

const events = { INC: fc.constant({}), RESET: fc.constant({}) };
const dir = mkdtempSync(join(tmpdir(), 'xstate-test-vitest-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('@xstate/test/vitest', () => {
  modelIt.model('it.model runs a campaign', counterMachine, {
    seed: 1,
    numRuns: 20,
    events,
    sut: counterSut(false),
    failures: { dir }
  });

  modelIt.model.fails(
    'it.model.fails expects a counterexample',
    counterMachine,
    {
      seed: 1,
      numRuns: 50,
      maxCommands: 6,
      events,
      sut: counterSut(true),
      failures: { dir }
    },
    { message: /Property observation diverged/ }
  );

  modelTest.paths('test.paths walks the graph', counterMachine, {
    events,
    sut: counterSut(false),
    stopWhen: (snapshot) => snapshot.context.count >= 3
  });

  it('saved the expected failure under the test file and name', () => {
    expect(readdirSync(dir)).toEqual([
      'test-vitest.test.ts-xstate-test-vitest-it.model.fails-expects-a-counterexample'
    ]);
  });
});

describe('withModelTests', () => {
  interface Registered {
    name: string;
    fn: (context: unknown) => Promise<void>;
    timeout?: number;
  }

  function fakeIt() {
    const registered: Registered[] = [];
    const base = (
      name: string,
      fn: (context: unknown) => Promise<void>,
      timeout?: number
    ) => {
      registered.push({ name, fn, timeout });
    };
    return { base, registered };
  }

  function contextFor(name: string) {
    return {
      task: {
        name,
        meta: {} as Record<string, unknown>,
        file: { name: 'cart.test.ts' },
        suite: { name: 'cart', suite: { name: '' } }
      }
    };
  }

  it('sets the timeout from until.timeMs and attaches coverage to the task', async () => {
    const { base, registered } = fakeIt();
    withModelTests(base).model('bounded', counterMachine, {
      events,
      until: { timeMs: 50 },
      failures: false
    });
    expect(registered[0].timeout).toBe(5_050);
    const context = contextFor('bounded');
    await registered[0].fn(context);
    expect(context.task.meta.xstateTestCoverage).toMatchObject({
      formatVersion: 1
    });
  });

  it('prints the coverage report when the campaign fails', async () => {
    const { base, registered } = fakeIt();
    withModelTests(base).model('broken', counterMachine, {
      seed: 1,
      numRuns: 50,
      maxCommands: 6,
      events,
      sut: counterSut(true),
      failures: false
    });
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      await expect(registered[0].fn(contextFor('broken'))).rejects.toThrow(
        /Property observation diverged/
      );
      expect(log.mock.calls[0][0]).toMatch(/^Test coverage\n/);
    } finally {
      log.mockRestore();
    }
  });

  it('fails an expected failure that passes or does not match', async () => {
    const { base, registered } = fakeIt();
    const modelTests = withModelTests(base);
    modelTests.model.fails('passes', counterMachine, {
      events,
      sut: counterSut(false),
      failures: false
    });
    modelTests.model.fails(
      'other message',
      counterMachine,
      { events, sut: counterSut(true), failures: false },
      { message: 'something else' }
    );
    await expect(registered[0].fn(contextFor('passes'))).rejects.toThrow(
      'Expected "passes" to fail, but the campaign passed.'
    );
    await expect(registered[1].fn(contextFor('other message'))).rejects.toThrow(
      /Expected "other message" to fail with a message matching something else/
    );
  });

  it('keys the failure database by file, suites, and test name', async () => {
    const { base, registered } = fakeIt();
    withModelTests(base).model.fails('keyed', counterMachine, {
      seed: 1,
      events,
      sut: counterSut(true),
      failures: { dir: join(dir, 'keyed') }
    });
    await registered[0].fn(contextFor('keyed'));
    expect(readdirSync(join(dir, 'keyed'))).toEqual([
      'cart.test.ts-cart-keyed'
    ]);
  });
});
