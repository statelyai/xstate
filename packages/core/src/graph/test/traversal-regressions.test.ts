import { createLogic, createMachine } from '../../index.ts';
import { z } from 'zod';
import { getAdjacencyMap } from '../adjacency.ts';
import { getPathsFromEvents } from '../pathFromEvents.ts';
import { getShortestPaths } from '../shortestPaths.ts';
import { getSimplePaths } from '../simplePaths.ts';

const counter = createLogic({
  context: ({ input }: { input: number }) => input,
  run: ({ context, event }) =>
    event.type === 'INC' ? { context: context + 1 } : undefined
});

it('replays a finite sequence on unbounded logic', () => {
  const [path] = getPathsFromEvents(counter, [{ type: 'INC' }], {
    input: 10,
    limit: 1
  });
  expect(path.state.context).toBe(11);
  expect(path.weight).toBe(1);
});

it('uses input when replaying machine events', () => {
  const machine = createMachine({
    schemas: { input: z.object({ count: z.number() }) },
    context: ({ input }) => input
  });
  expect(
    getPathsFromEvents(machine, [], { input: { count: 7 } })[0].state.context
  ).toEqual({ count: 7 });
});

it.each([getShortestPaths, getSimplePaths])(
  'initializes custom logic once in a path generator',
  (generate) => {
    let initializations = 0;
    const logic = {
      ...counter,
      getInitialSnapshot: (
        ...args: Parameters<typeof counter.getInitialSnapshot>
      ) => ({
        ...counter.getInitialSnapshot(...args),
        context: initializations++
      })
    };
    expect(generate(logic, { input: 0, events: [] })).toHaveLength(1);
    expect(initializations).toBe(1);
  }
);

it.each(['constructor', 'toString', '__proto__', ''])(
  'accepts arbitrary serialized state/event keys: %s',
  (key) => {
    const options = {
      input: 0,
      events: [{ type: 'INC' }],
      stopWhen: (state: { context: number }) => state.context === 1,
      serializeState: (state: { context: number }) =>
        state.context === 0 ? key : 'end',
      serializeEvent: () => key
    };
    const adjacency = getAdjacencyMap(counter, options);
    expect(Object.keys(adjacency)).toEqual([key, 'end']);
    expect(
      Object.keys(adjacency[key as keyof typeof adjacency].transitions)
    ).toEqual([key]);
    for (const generate of [getShortestPaths, getSimplePaths]) {
      const path = generate(counter, options).find(
        (p) => p.state.context === 1
      )!;
      expect(path.weight).toBe(1);
      expect(path.steps).toHaveLength(2);
    }
  }
);

it('honors replay filters, stopping and target predicates', () => {
  const events = [{ type: 'INC' }, { type: 'INC' }];
  expect(() =>
    getPathsFromEvents(counter, events, {
      input: 0,
      filterEvents: (state) => state.context === 0
    })
  ).toThrow('Invalid transition');
  expect(() =>
    getPathsFromEvents(counter, events, {
      input: 0,
      stopWhen: (state) => state.context === 1
    })
  ).toThrow('Invalid transition');
  expect(
    getPathsFromEvents(counter, events, {
      input: 0,
      toState: (state) => state.context === 3
    })
  ).toEqual([]);
});

it('replays the last permitted override candidate matching a serialized event', () => {
  const logic = createLogic({
    context: 0,
    run: ({
      context,
      event
    }: {
      context: number;
      event: { type: string; amount: number };
    }) =>
      event.type === 'ADD' ? { context: context + event.amount } : undefined
  });
  const [path] = getPathsFromEvents(logic, [{ type: 'ADD', amount: 100 }], {
    serializeEvent: (event) => event.type,
    events: [
      { type: 'ADD', amount: 1 },
      { type: 'ADD', amount: 2 },
      { type: 'ADD', amount: 3 }
    ],
    filterEvents: (_, event) => event.amount < 3
  });
  expect(path.state.context).toBe(2);
  expect(path.steps[1].event).toEqual({ type: 'ADD', amount: 100 });
});

it.each(['shortest', 'simple', 'replay'] as const)(
  'initializes a machine once with explicit undefined fromState: %s',
  (mode) => {
    const machine = createMachine({ initial: 'idle', states: { idle: {} } });
    const initialize = vi.spyOn(machine, 'getInitialSnapshot');
    const options = { fromState: undefined, events: [] };
    const paths =
      mode === 'replay'
        ? getPathsFromEvents(machine, [], options)
        : (mode === 'shortest' ? getShortestPaths : getSimplePaths)(
            machine,
            options
          );
    expect(paths).toHaveLength(1);
    expect(initialize).toHaveBeenCalledTimes(1);
  }
);
