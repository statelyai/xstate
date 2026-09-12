import { createMachine } from '../../index.ts';
import { types } from '../../index.ts';
import {
  checkLinearizable,
  runParallelPropertyCommands,
  type LinearizabilityEntry
} from '../propertyLinearizability.ts';

type RegisterEvent =
  | { type: 'write'; value: number }
  | { type: 'read' }
  | { type: 'inc' };

const registerModel = {
  initial: 0,
  apply: (state: number, event: RegisterEvent) => {
    switch (event.type) {
      case 'write':
        return { state: event.value, response: undefined };
      case 'inc':
        return { state: state + 1, response: state + 1 };
      default:
        return { state, response: state };
    }
  }
};

describe('checkLinearizable', () => {
  it('accepts a history that has a valid sequential order', () => {
    const history: LinearizabilityEntry<RegisterEvent>[] = [
      {
        id: 'a',
        invocation: { type: 'write', value: 1 },
        response: undefined,
        start: 0,
        end: 4
      },
      // overlaps the write, so it may be ordered before or after it
      { id: 'b', invocation: { type: 'read' }, response: 1, start: 1, end: 5 },
      { id: 'c', invocation: { type: 'read' }, response: 1, start: 6, end: 7 }
    ];

    const result = checkLinearizable(history, registerModel);

    expect(result.linearizable).toBe(true);
    expect(result.truncated).toBe(false);
    expect(result.witness?.map((entry) => entry.id)).toEqual(['a', 'b', 'c']);
  });

  it('rejects a stale read that no sequential order explains', () => {
    const history: LinearizabilityEntry<RegisterEvent>[] = [
      {
        id: 'a',
        invocation: { type: 'write', value: 1 },
        response: undefined,
        start: 0,
        end: 1
      },
      // starts after the write completed, so it cannot be reordered before it
      { id: 'b', invocation: { type: 'read' }, response: 0, start: 2, end: 3 }
    ];

    const result = checkLinearizable(history, registerModel);

    expect(result.linearizable).toBe(false);
    expect(result.witness).toBeUndefined();
    expect(result.truncated).toBe(false);
  });

  it('reorders concurrent operations to find a witness', () => {
    const history: LinearizabilityEntry<RegisterEvent>[] = [
      {
        id: 'a',
        invocation: { type: 'write', value: 1 },
        response: undefined,
        start: 0,
        end: 10
      },
      // fully concurrent with the write, and observed the pre-write value
      { id: 'b', invocation: { type: 'read' }, response: 0, start: 1, end: 9 }
    ];

    const result = checkLinearizable(history, registerModel);

    expect(result.linearizable).toBe(true);
    expect(result.witness?.map((entry) => entry.id)).toEqual(['b', 'a']);
  });

  it('reports truncation when the exploration bound is hit', () => {
    const history: LinearizabilityEntry<RegisterEvent>[] = Array.from(
      { length: 6 },
      (_, index) => ({
        id: index,
        invocation: { type: 'inc' } as RegisterEvent,
        // all operations overlap, so every permutation is a candidate
        response: index + 1,
        start: 0,
        end: 100
      })
    );

    const result = checkLinearizable(history, registerModel, {
      maxExplored: 3
    });

    // the history is linearizable, but the bound stopped the search first
    expect(result.linearizable).toBe(false);
    expect(result.truncated).toBe(true);
    expect(result.explored).toBeLessThanOrEqual(3);
    expect(checkLinearizable(history, registerModel).linearizable).toBe(true);
  });
});

const counterMachine = createMachine({
  id: 'counter',
  schemas: {
    context: types<{ count: number }>(),
    events: { INC: types<{}>() }
  },
  context: { count: 0 },
  on: {
    INC: ({ context }) => ({ context: { count: context.count + 1 } })
  }
});

/** Resolves after `ticks` microtask turns. */
const tick = async (ticks: number) => {
  for (let index = 0; index < ticks; index++) {
    await Promise.resolve();
  }
};

describe('runParallelPropertyCommands', () => {
  it('passes for an atomic counter', async () => {
    const result = await runParallelPropertyCommands(counterMachine, {
      prefix: [{ type: 'INC' }],
      branches: [[{ type: 'INC' }, { type: 'INC' }], [{ type: 'INC' }]],
      sut: {
        create: () => {
          let count = 0;
          return {
            send: async () => {
              // the increment and the response are taken together
              const observed = ++count;
              await tick(1);
              return observed;
            }
          };
        },
        projectModel: (snapshot) => snapshot.context.count
      }
    });

    expect(result.history).toHaveLength(3);
    expect(result.linearizable).toBe(true);
    expect(result.truncated).toBe(false);
  });

  it('fails for a counter with a non-atomic read-modify-write', async () => {
    const result = await runParallelPropertyCommands(counterMachine, {
      prefix: [{ type: 'INC' }],
      branches: [
        [{ type: 'INC' }, { type: 'INC' }],
        [{ type: 'INC' }, { type: 'INC' }]
      ],
      sut: {
        create: () => {
          let count = 0;
          return {
            send: async () => {
              const read = count;
              // the interleaving point: another branch writes here
              await tick(2);
              count = read + 1;
              return count;
            }
          };
        },
        projectModel: (snapshot) => snapshot.context.count
      }
    });

    expect(result.linearizable).toBe(false);
    expect(result.truncated).toBe(false);
  });
});
