import z from 'zod';
import {
  createMachine,
  createStepLogic,
  types,
  type EventFromLogic,
  type InputFrom,
  type SnapshotFrom
} from '../index.ts';
import {
  getShortestPaths,
  getSimplePaths,
  getAdjacencyMap,
  getPathsFromEvents,
  type PathGenerator,
  type EventCases
} from './index.ts';

describe('getShortestPath types', () => {
  it('`getEvents` should be allowed to return a mutable array', () => {
    const machine = createMachine({
      // types: {} as {
      //   events: { type: 'FOO' } | { type: 'BAR' };
      // }
      schemas: {
        events: {
          FOO: z.object({}),
          BAR: z.object({})
        }
      }
    });

    getShortestPaths(machine, {
      events: [
        {
          type: 'FOO'
        }
      ]
    });
  });

  it('`getEvents` should be allowed to return a readonly array', () => {
    const machine = createMachine({
      // types: {} as {
      //   events: { type: 'FOO' } | { type: 'BAR' };
      // }
      schemas: {
        events: {
          FOO: z.object({}),
          BAR: z.object({})
        }
      }
    });

    getShortestPaths(machine, {
      events: [
        {
          type: 'FOO'
        }
      ]
    });
  });

  it('`events` should allow known event', () => {
    const machine = createMachine({
      // types: {} as {
      //   events: { type: 'FOO'; value: number };
      // }
      schemas: {
        events: {
          FOO: z.object({ value: z.number() })
        }
      }
    });

    getShortestPaths(machine, {
      events: [
        {
          type: 'FOO',
          value: 100
        }
      ]
    });
  });

  it('`events` should require all required event types (array literal expression)', () => {
    const machine = createMachine({
      // types: {} as {
      //   events: { type: 'FOO'; value: number } | { type: 'BAR'; value: number };
      // }
      schemas: {
        events: {
          FOO: z.object({ value: z.number() }),
          BAR: z.object({ value: z.number() })
        }
      }
    });

    // @ts-expect-error BAR needs a payload sample.
    getShortestPaths(machine, {
      events: [{ type: 'FOO', value: 100 }]
    });
  });

  it('`events` should require all required event types (tuple)', () => {
    const machine = createMachine({
      schemas: {
        events: {
          FOO: z.object({ value: z.number() }),
          BAR: z.object({ value: z.number() })
        }
      }
    });

    const events = [{ type: 'FOO', value: 100 }] as const;

    // @ts-expect-error BAR needs a payload sample.
    getShortestPaths(machine, {
      events
    });
  });

  it('`events` should require all required event types (function)', () => {
    const machine = createMachine({
      schemas: {
        events: {
          FOO: z.object({ value: z.number() }),
          BAR: z.object({ value: z.number() })
        }
      }
    });

    // @ts-expect-error BAR needs a payload sample.
    getShortestPaths(machine, {
      events: () => [{ type: 'FOO', value: 100 }] as const
    });
  });

  it('`events` should not allow unknown events', () => {
    const machine = createMachine({
      // types: { events: {} as { type: 'FOO'; value: number } }
      schemas: {
        events: {
          FOO: z.object({ value: z.number() })
        }
      }
    });

    getShortestPaths(machine, {
      events: [
        {
          // @ts-expect-error
          type: 'UNKNOWN',
          value: 100
        }
      ]
    });
  });

  it('`events` should only allow props of a specific event', () => {
    const machine = createMachine({
      // types: {} as {
      //   events: { type: 'FOO'; value: number } | { type: 'BAR'; other: string };
      // }
      schemas: {
        events: {
          FOO: z.object({ value: z.number() }),
          BAR: z.object({ other: z.string() })
        }
      }
    });

    getShortestPaths(machine, {
      events: [
        {
          type: 'FOO',
          // @ts-expect-error
          other: 'nana nana nananana'
        }
      ]
    });
  });

  it('`serializeEvent` should be allowed to return plain string', () => {
    const machine = createMachine({});

    getShortestPaths(machine, {
      serializeEvent: () => ''
    });
  });

  it('`serializeState` should be allowed to return plain string', () => {
    const machine = createMachine({});

    getShortestPaths(machine, {
      serializeState: () => ''
    });
  });
});

describe('required traversal payload cases', () => {
  it('supports event objects whose type field is a union', () => {
    const logic = createStepLogic({
      context: 0,
      run: ({
        event
      }: {
        context: number;
        event: { type: 'ADD' | 'REMOVE'; value: number };
      }) => ({ context: event.value })
    });
    const events: EventCases<
      SnapshotFrom<typeof logic>,
      EventFromLogic<typeof logic>
    > = {
      ADD: [{ value: 1 }],
      REMOVE: [{ value: -1 }]
    };
    expect(
      getShortestPaths(logic, {
        events,
        stopWhen: (snapshot) => snapshot.context !== 0
      })
    ).toHaveLength(3);
    const invalid: EventCases<
      SnapshotFrom<typeof logic>,
      EventFromLogic<typeof logic>
    > = {
      // @ts-expect-error A union discriminator still requires the payload.
      ADD: [{}],
      REMOVE: [{ value: -1 }]
    };
    expect(invalid.ADD).toBeDefined();
  });

  it('keeps built-in and custom path generators compatible', () => {
    const machine = createMachine({
      schemas: {
        events: { ADD: types<{ value: number }>(), EMPTY: types<{}>() }
      }
    });
    type Generator = PathGenerator<
      SnapshotFrom<typeof machine>,
      EventFromLogic<typeof machine>,
      InputFrom<typeof machine>
    >;
    const custom: Generator = (_logic, _options) => [];
    const generators: Generator[] = [getShortestPaths, getSimplePaths, custom];
    for (const generate of generators) {
      generate(machine, { events: { ADD: [{ value: 1 }] } });
      generate(machine, { events: [{ type: 'ADD', value: 1 }] });
      // @ts-expect-error Generator calls require payload cases too.
      generate(machine);
      // @ts-expect-error An empty list does not cover ADD.
      generate(machine, { events: [] });
    }
  });

  it('getShortestPaths checks required payload cases', () => {
    const machine = createMachine({
      schemas: {
        context: z.object({ count: z.number() }),
        events: {
          ADD: z.object({ value: z.number() }),
          REMOVE: z.object({ id: z.string() }),
          OPTIONAL: types<{ label?: string }>()
        }
      },
      context: { count: 0 }
    });
    // @ts-expect-error Required payload event cases cannot be omitted.
    getShortestPaths(machine);
    // @ts-expect-error Required payload event cases cannot be omitted.
    getShortestPaths(machine, {});
    // @ts-expect-error REMOVE needs its own sample.
    getShortestPaths(machine, { events: { ADD: [{ value: 1 }] } });
    getShortestPaths(machine, {
      events: {
        ADD: [{ value: 1 }, { value: 0 }],
        REMOVE: (snapshot) => [{ id: String(snapshot.context.count) }]
      }
    });
    // @ts-expect-error Empty static cases cannot represent required payloads.
    getShortestPaths(machine, { events: { ADD: [], REMOVE: [{ id: 'id' }] } });
    getShortestPaths(machine, {
      // @ts-expect-error Empty generated cases cannot represent required payloads.
      events: { ADD: () => [], REMOVE: [{ id: 'id' }] }
    });
    getShortestPaths(machine, {
      // @ts-expect-error Incorrect payload field type.
      events: { ADD: [{ value: 'bad' }], REMOVE: [{ id: 'id' }] }
    });
    getShortestPaths(machine, {
      // @ts-expect-error Missing required field value.
      events: { ADD: [{}], REMOVE: [{ id: 'id' }] }
    });
    getShortestPaths(machine, {
      // @ts-expect-error Unknown event key.
      events: { ADD: [{ value: 1 }], REMOVE: [{ id: 'id' }], UNKNOWN: [{}] }
    });
    // @ts-expect-error An optional payload event does not cover required events.
    getShortestPaths(machine, { events: [{ type: 'OPTIONAL' }] });
    getShortestPaths(machine, {
      events: [
        { type: 'ADD', value: 1 },
        { type: 'REMOVE', id: 'id' }
      ]
    });
    getShortestPaths(machine, {
      events: (snapshot) => [
        { type: 'ADD', value: snapshot.context.count },
        { type: 'REMOVE', id: 'id' }
      ]
    });
    getShortestPaths(machine, {
      events: [{ type: 'ADD', value: 1 }],
      // @ts-expect-error Diagnostic properties cannot provide missing samples.
      missingEventCases: 'REMOVE'
    });
    // @ts-expect-error Callback misses REMOVE samples.
    getShortestPaths(machine, { events: () => [{ type: 'ADD', value: 1 }] });
    getPathsFromEvents(machine, [{ type: 'ADD', value: 1 }]);
    // @ts-expect-error Replay still requires correctly typed events.
    getPathsFromEvents(machine, [{ type: 'ADD' }]);
  });

  it('getSimplePaths checks required payload cases', () => {
    const machine = createMachine({
      schemas: {
        context: z.object({ count: z.number() }),
        events: {
          ADD: z.object({ value: z.number() }),
          REMOVE: z.object({ id: z.string() }),
          OPTIONAL: types<{ label?: string }>()
        }
      },
      context: { count: 0 }
    });
    // @ts-expect-error Required payload event cases cannot be omitted.
    getSimplePaths(machine);
    // @ts-expect-error Required payload event cases cannot be omitted.
    getSimplePaths(machine, {});
    // @ts-expect-error REMOVE needs its own sample.
    getSimplePaths(machine, { events: { ADD: [{ value: 1 }] } });
    getSimplePaths(machine, {
      events: {
        ADD: [{ value: 1 }, { value: 0 }],
        REMOVE: (snapshot) => [{ id: String(snapshot.context.count) }]
      }
    });
    // @ts-expect-error Empty static cases cannot represent required payloads.
    getSimplePaths(machine, { events: { ADD: [], REMOVE: [{ id: 'id' }] } });
    getSimplePaths(machine, {
      // @ts-expect-error Empty generated cases cannot represent required payloads.
      events: { ADD: () => [], REMOVE: [{ id: 'id' }] }
    });
    getSimplePaths(machine, {
      // @ts-expect-error Incorrect payload field type.
      events: { ADD: [{ value: 'bad' }], REMOVE: [{ id: 'id' }] }
    });
    // @ts-expect-error Missing required field value.
    getSimplePaths(machine, { events: { ADD: [{}], REMOVE: [{ id: 'id' }] } });
    getSimplePaths(machine, {
      // @ts-expect-error Unknown event key.
      events: { ADD: [{ value: 1 }], REMOVE: [{ id: 'id' }], UNKNOWN: [{}] }
    });
    // @ts-expect-error An optional payload event does not cover required events.
    getSimplePaths(machine, { events: [{ type: 'OPTIONAL' }] });
    getSimplePaths(machine, {
      events: [
        { type: 'ADD', value: 1 },
        { type: 'REMOVE', id: 'id' }
      ]
    });
    getSimplePaths(machine, {
      events: (snapshot) => [
        { type: 'ADD', value: snapshot.context.count },
        { type: 'REMOVE', id: 'id' }
      ]
    });
    // @ts-expect-error Callback misses REMOVE samples.
    getSimplePaths(machine, { events: () => [{ type: 'ADD', value: 1 }] });
    getPathsFromEvents(machine, [{ type: 'ADD', value: 1 }]);
    // @ts-expect-error Replay still requires correctly typed events.
    getPathsFromEvents(machine, [{ type: 'ADD' }]);
  });

  it('getAdjacencyMap checks required payload cases', () => {
    const machine = createMachine({
      schemas: {
        context: z.object({ count: z.number() }),
        events: {
          ADD: z.object({ value: z.number() }),
          REMOVE: z.object({ id: z.string() }),
          OPTIONAL: types<{ label?: string }>()
        }
      },
      context: { count: 0 }
    });
    // @ts-expect-error Required payload event cases cannot be omitted.
    getAdjacencyMap(machine);
    // @ts-expect-error Required payload event cases cannot be omitted.
    getAdjacencyMap(machine, {});
    // @ts-expect-error REMOVE needs its own sample.
    getAdjacencyMap(machine, { events: { ADD: [{ value: 1 }] } });
    getAdjacencyMap(machine, {
      events: {
        ADD: [{ value: 1 }, { value: 0 }],
        REMOVE: (snapshot) => [{ id: String(snapshot.context.count) }]
      }
    });
    // @ts-expect-error Empty static cases cannot represent required payloads.
    getAdjacencyMap(machine, { events: { ADD: [], REMOVE: [{ id: 'id' }] } });
    getAdjacencyMap(machine, {
      // @ts-expect-error Empty generated cases cannot represent required payloads.
      events: { ADD: () => [], REMOVE: [{ id: 'id' }] }
    });
    getAdjacencyMap(machine, {
      // @ts-expect-error Incorrect payload field type.
      events: { ADD: [{ value: 'bad' }], REMOVE: [{ id: 'id' }] }
    });
    // @ts-expect-error Missing required field value.
    getAdjacencyMap(machine, { events: { ADD: [{}], REMOVE: [{ id: 'id' }] } });
    getAdjacencyMap(machine, {
      // @ts-expect-error Unknown event key.
      events: { ADD: [{ value: 1 }], REMOVE: [{ id: 'id' }], UNKNOWN: [{}] }
    });
    // @ts-expect-error An optional payload event does not cover required events.
    getAdjacencyMap(machine, { events: [{ type: 'OPTIONAL' }] });
    getAdjacencyMap(machine, {
      events: [
        { type: 'ADD', value: 1 },
        { type: 'REMOVE', id: 'id' }
      ]
    });
    getAdjacencyMap(machine, {
      events: (snapshot) => [
        { type: 'ADD', value: snapshot.context.count },
        { type: 'REMOVE', id: 'id' }
      ]
    });
    // @ts-expect-error Callback misses REMOVE samples.
    getAdjacencyMap(machine, { events: () => [{ type: 'ADD', value: 1 }] });
    getPathsFromEvents(machine, [{ type: 'ADD', value: 1 }]);
    // @ts-expect-error Replay still requires correctly typed events.
    getPathsFromEvents(machine, [{ type: 'ADD' }]);
  });

  it('permits defaults for payload-free alternatives with the same event type', () => {
    const machine = createMachine({
      schemas: {
        events: {
          EVENT: z.union([z.object({ value: z.number() }), z.object({})])
        }
      }
    });
    getShortestPaths(machine);
    getSimplePaths(machine);
    getAdjacencyMap(machine);
  });
});
