import { setup, types } from '../../index.ts';
import {
  getAdjacencyMap,
  getPathsFromEvents,
  getShortestPaths,
  getSimplePaths
} from '../index.ts';

describe.each([
  ['getAdjacencyMap', getAdjacencyMap],
  ['getShortestPaths', getShortestPaths],
  ['getSimplePaths', getSimplePaths]
] as const)('%s diagnostics', (_, traverse) => {
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

    expect(() => traverse(machine, {})).toThrow(
      expect.objectContaining({
        message: expect.stringContaining('"value":"empty"'),
        cause
      })
    );
    expect(() => traverse(machine, {})).toThrow(/"type":"ADD"/);
    expect(() => traverse(machine, {})).toThrow(/events/);
    expect(() =>
      traverse(machine, { events: [{ type: 'ADD', quantity: 2 }] })
    ).not.toThrow();
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
