import { setup, types } from '../../index.ts';
import type { AnyStateMachine } from '../../index.ts';
import {
  getAdjacencyMap,
  getPathsFromEvents,
  getShortestPaths,
  getSimplePaths
} from '../index.ts';

describe.each([
  'getAdjacencyMap',
  'getShortestPaths',
  'getSimplePaths'
] as const)('%s diagnostics', (method) => {
  it('identifies the state and event that failed and preserves the cause', () => {
    const cause = new Error('Quantity is required');
    const machine = setup({
      schemas: { events: { ADD: types<{ quantity: number }>() } }
    }).createMachine({
      initial: 'empty',
      states: {
        empty: {
          on: {
            ADD: ({ event }) => {
              if (event.quantity === undefined) {
                throw cause;
              }
              return { target: 'filled' };
            }
          }
        },
        filled: {}
      }
    });
    const runtimeMachine: AnyStateMachine = machine;
    const traverse = (events?: Array<{ type: 'ADD'; quantity: number }>) => {
      switch (method) {
        case 'getAdjacencyMap':
          return events
            ? getAdjacencyMap(runtimeMachine, { events })
            : getAdjacencyMap(runtimeMachine);
        case 'getShortestPaths':
          return events
            ? getShortestPaths(runtimeMachine, { events })
            : getShortestPaths(runtimeMachine);
        case 'getSimplePaths':
          return events
            ? getSimplePaths(runtimeMachine, { events })
            : getSimplePaths(runtimeMachine);
      }
    };

    expect(() => traverse()).toThrow(
      expect.objectContaining({
        message: expect.stringContaining('"value":"empty"'),
        cause
      })
    );
    expect(() => traverse()).toThrow(/"type":"ADD"/);
    expect(() => traverse()).toThrow(/events/);
    expect(() => traverse([{ type: 'ADD', quantity: 2 }])).not.toThrow();
  });
});

it('preserves non-Error failures when evaluating an explicit event path', () => {
  const machine = setup({}).createMachine({
    initial: 'idle',
    states: {
      idle: {
        on: {
          FAIL: () => {
            throw 'transition failed';
          }
        }
      }
    }
  });

  expect(() => getPathsFromEvents(machine, [{ type: 'FAIL' }])).toThrow(
    expect.objectContaining({
      message: expect.stringContaining('"value":"idle"'),
      cause: 'transition failed'
    })
  );
});
