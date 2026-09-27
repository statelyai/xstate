import z from 'zod';
import { createMachine } from '../index.ts';
import { createTestModel, getShortestPaths } from './index.ts';

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

  it('`events` should not require all event types (array literal expression)', () => {
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

    getShortestPaths(machine, {
      events: [{ type: 'FOO', value: 100 }]
    });
  });

  it('`events` should not require all event types (tuple)', () => {
    const machine = createMachine({
      schemas: {
        events: {
          FOO: z.object({ value: z.number() }),
          BAR: z.object({ value: z.number() })
        }
      }
    });

    const events = [{ type: 'FOO', value: 100 }] as const;

    getShortestPaths(machine, {
      events
    });
  });

  it('`events` should not require all event types (function)', () => {
    const machine = createMachine({
      schemas: {
        events: {
          FOO: z.object({ value: z.number() }),
          BAR: z.object({ value: z.number() })
        }
      }
    });

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

describe('createTestModel types', () => {
  it('`EventExecutor` should be passed event with type that corresponds to its key', () => {
    const machine = createMachine({
      id: 'test',
      // types: {
      //   events: {} as
      //     | { type: 'a'; valueA: boolean }
      //     | { type: 'b'; valueB: number }
      // },
      schemas: {
        events: {
          a: z.object({ valueA: z.boolean() }),
          b: z.object({ valueB: z.number() })
        }
      },
      initial: 'a',
      states: {
        a: {
          on: {
            a: { target: '#test.b' }
          }
        },
        b: {
          on: {
            b: { target: '#test.a' }
          }
        }
      }
    });

    for (const path of createTestModel(machine).getShortestPaths()) {
      path.test({
        events: {
          a: ({ event }) => {
            ((_accept: 'a') => {})(event.type);
            // @ts-expect-error
            ((_accept: 'b') => {})(event.type);
          },
          b: ({ event }) => {
            // @ts-expect-error
            ((_accept: 'a') => {})(event.type);
            ((_accept: 'b') => {})(event.type);
          }
        }
      });
    }
  });
});
