import { z } from 'zod';
import {
  createAsyncLogic,
  createMachine,
  createStepLogic,
  types
} from '../../index.ts';
import { getAdjacencyMap, getShortestPaths, getSimplePaths } from '../index.ts';

const machine = createMachine({
  schemas: {
    context: z.object({ count: z.number() }),
    events: {
      'item.add': z.object({ item: z.object({ qty: z.number() }) }),
      NEXT: types<{ label?: string }>()
    }
  },
  context: { count: 0 },
  initial: 'idle',
  states: {
    idle: { on: { NEXT: () => ({ target: 'ready', context: { count: 2 } }) } },
    ready: {
      on: {
        'item.add': ({ event }) => ({
          target: event.item.qty > 0 ? 'added' : 'empty'
        })
      }
    },
    added: {},
    empty: {}
  }
});

it.each(['adjacency', 'shortest', 'simple'] as const)(
  'explores each payload case from applicable snapshots with %s',
  (mode) => {
    const sampledStates: unknown[] = [];
    const options = {
      events: {
        NEXT: undefined,
        'item.add': (
          snapshot: ReturnType<typeof machine.getInitialSnapshot>
        ) => {
          sampledStates.push(snapshot.value);
          return [
            { item: { qty: snapshot.context.count } },
            { item: { qty: 0 } }
          ] as const;
        }
      }
    };
    const result =
      mode === 'adjacency'
        ? Object.values(getAdjacencyMap(machine, options)).map(
            ({ state, transitions }) => ({
              state,
              events: Object.values<
                (typeof transitions)[keyof typeof transitions]
              >(transitions).map(({ event }) => event)
            })
          )
        : (mode === 'shortest' ? getShortestPaths : getSimplePaths)(
            machine,
            options
          ).map(({ state, steps }) => ({
            state,
            events: steps.map(({ event }) => event)
          }));
    expect(result.map(({ state }) => state.value)).toEqual([
      'idle',
      'ready',
      'added',
      'empty'
    ]);
    expect(result.flatMap(({ events }) => events)).toContainEqual({
      type: 'item.add',
      item: { qty: 2 }
    });
    expect(sampledStates).toEqual(['ready']);
  }
);

it('preserves invoke completion, errors and delays when augmenting samples', () => {
  const withSynthetic = createMachine({
    schemas: { events: { PICK: z.object({ count: z.number() }) } },
    initial: 'waiting',
    states: {
      waiting: {
        invoke: {
          src: createAsyncLogic({ run: async () => 'done' }),
          onDone: { target: 'success' },
          onError: { target: 'failure' }
        },
        after: { 100: { target: 'timeout' } },
        on: {
          PICK: ({ event }) => (event.count ? { target: 'picked' } : undefined)
        }
      },
      success: {},
      failure: {},
      timeout: {},
      picked: {}
    }
  });
  const adjacency = getAdjacencyMap(withSynthetic, {
    events: { PICK: [{ count: 1 }] }
  });
  expect(
    Object.values(adjacency)
      .map(({ state }) => state.value)
      .sort()
  ).toEqual(['failure', 'picked', 'success', 'timeout', 'waiting']);
});

it('uses concrete payload cases for wildcard transitions', () => {
  const wildcard = createMachine({
    schemas: { events: { 'item.add': z.object({ qty: z.number() }) } },
    initial: 'idle',
    states: {
      idle: {
        on: {
          'item.*': ({ event }) => (event.qty ? { target: 'added' } : undefined)
        }
      },
      added: {}
    }
  });
  expect(
    getShortestPaths(wildcard, { events: { 'item.add': [{ qty: 1 }] } }).map(
      ({ state }) => state.value
    )
  ).toEqual(['idle', 'added']);
});

it('keeps list and callback samples as complete replacements', () => {
  for (const events of [
    [{ type: 'item.add', item: { qty: 1 } }] as const,
    () => [{ type: 'item.add', item: { qty: 1 } }] as const
  ]) {
    expect(
      getShortestPaths(machine, { events }).map(({ state }) => state.value)
    ).toEqual(['idle']);
  }
});

it('rejects explicitly empty static and generated cases', () => {
  for (const events of [{ 'item.add': [] }, { 'item.add': () => [] }]) {
    expect(() =>
      getAdjacencyMap(machine, {
        // @ts-expect-error Runtime JavaScript callers may supply empty cases.
        events
      })
    ).toThrow('Event cases for "item.add" must be a non-empty array');
  }
});

it('propagates transition exceptions', () => {
  const error = new Error('broken transition');
  const throwing = createMachine({
    initial: 'idle',
    states: {
      idle: {
        on: {
          GO: () => {
            throw error;
          }
        }
      }
    }
  });
  try {
    getAdjacencyMap(throwing);
    expect.unreachable('Transition errors must abort traversal');
  } catch (failure) {
    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).cause).toBe(error);
    expect((failure as Error).message).toContain('idle');
    expect((failure as Error).message).toContain('GO');
    expect((failure as Error).message).toContain('broken transition');
  }
});

it('generates keyed cases for custom actor logic', () => {
  const logic = createStepLogic({
    context: 0,
    run: ({
      context,
      event
    }: {
      context: number;
      event: { type: 'ADD'; amount: number };
    }) =>
      event.type === 'ADD' ? { context: context + event.amount } : undefined
  });
  const paths = getShortestPaths(logic, {
    events: { ADD: (snapshot) => [{ amount: snapshot.context + 1 }] },
    stopWhen: (snapshot) => snapshot.context >= 3
  });
  expect(paths.map(({ state }) => state.context)).toEqual([0, 1, 3]);
});
