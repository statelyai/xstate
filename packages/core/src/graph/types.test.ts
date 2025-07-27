import z from 'zod';
import { next_createMachine } from '../index.ts';
import { createTestModel, getShortestPaths } from './index.ts';

describe('getShortestPath types', () => {
  it('`getEvents` should be allowed to return a mutable array', () => {
    const machine = next_createMachine({
      // types: {} as {
      //   events: { type: 'FOO' } | { type: 'BAR' };
      // }
      schemas: {
        event: z.union([
          z.object({ type: z.literal('FOO') }),
          z.object({ type: z.literal('BAR') })
        ])
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
    const machine = next_createMachine({
      // types: {} as {
      //   events: { type: 'FOO' } | { type: 'BAR' };
      // }
      schemas: {
        event: z.union([
          z.object({ type: z.literal('FOO') }),
          z.object({ type: z.literal('BAR') })
        ])
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
    const machine = next_createMachine({
      // types: {} as {
      //   events: { type: 'FOO'; value: number };
      // }
      schemas: {
        event: z.object({ type: z.literal('FOO'), value: z.number() })
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
    const machine = next_createMachine({
      // types: {} as {
      //   events: { type: 'FOO'; value: number } | { type: 'BAR'; value: number };
      // }
      schemas: {
        event: z.union([
          z.object({ type: z.literal('FOO'), value: z.number() }),
          z.object({ type: z.literal('BAR'), value: z.number() })
        ])
      }
    });

    getShortestPaths(machine, {
      events: [{ type: 'FOO', value: 100 }]
    });
  });

  it('`events` should not require all event types (tuple)', () => {
    const machine = next_createMachine({
      schemas: {
        event: z.union([
          z.object({ type: z.literal('FOO'), value: z.number() }),
          z.object({ type: z.literal('BAR'), value: z.number() })
        ])
      }
    });

    const events = [{ type: 'FOO', value: 100 }] as const;

    getShortestPaths(machine, {
      events
    });
  });

  it('`events` should not require all event types (function)', () => {
    const machine = next_createMachine({
      schemas: {
        event: z.union([
          z.object({ type: z.literal('FOO'), value: z.number() }),
          z.object({ type: z.literal('BAR'), value: z.number() })
        ])
      }
    });

    getShortestPaths(machine, {
      events: () => [{ type: 'FOO', value: 100 }] as const
    });
  });

  it('`events` should not allow unknown events', () => {
    const machine = next_createMachine({
      // types: { events: {} as { type: 'FOO'; value: number } }
      schemas: {
        event: z.object({ type: z.literal('FOO'), value: z.number() })
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
    const machine = next_createMachine({
      // types: {} as {
      //   events: { type: 'FOO'; value: number } | { type: 'BAR'; other: string };
      // }
      schemas: {
        event: z.union([
          z.object({ type: z.literal('FOO'), value: z.number() }),
          z.object({ type: z.literal('BAR'), other: z.string() })
        ])
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
    const machine = next_createMachine({});

    getShortestPaths(machine, {
      serializeEvent: () => ''
    });
  });

  it('`serializeState` should be allowed to return plain string', () => {
    const machine = next_createMachine({});

    getShortestPaths(machine, {
      serializeState: () => ''
    });
  });
});

describe('createTestModel types', () => {
  it('`EventExecutor` should be passed event with type that corresponds to its key', () => {
    const machine = next_createMachine({
      id: 'test',
      // types: {
      //   events: {} as
      //     | { type: 'a'; valueA: boolean }
      //     | { type: 'b'; valueB: number }
      // },
      schemas: {
        event: z.union([
          z.object({ type: z.literal('a'), valueA: z.boolean() }),
          z.object({ type: z.literal('b'), valueB: z.number() })
        ])
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
