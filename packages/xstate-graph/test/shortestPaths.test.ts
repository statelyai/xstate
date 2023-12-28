import { assign, createMachine } from 'xstate';
import { joinPaths } from '../src/graph';
import { getShortestPaths } from '../src/shortestPaths';

describe('getShortestPaths', () => {
  it('finds the shortest paths to a state without continuing traversal from that state', () => {
    const m = createMachine({
      types: {} as { context: { count: number } },
      initial: 'a',
      context: { count: 0 },
      states: {
        a: {
          on: {
            NEXT: 'b'
          }
        },
        b: {
          on: {
            NEXT: 'c'
          }
        },
        c: {
          on: {
            NEXT: 'd'
          }
        },
        d: {
          // If we reach this state, this will cause an infinite loop
          // if the stop condition does not stop the algorithm
          on: {
            NEXT: {
              target: 'd',
              actions: assign({
                count: ({ context }) => context.count + 1
              })
            }
          }
        }
      }
    });

    const p = getShortestPaths(m, {
      toState: (state) => state.matches('c')
    });

    expect(p).toHaveLength(1);
    expect(p[0].state.matches('c')).toBeTruthy();
  });

  it('finds the shortest paths from a state to another state', () => {
    const m = createMachine({
      types: {} as {
        context: { count: number };
      },
      initial: 'a',
      context: { count: 0 },
      states: {
        a: {
          on: {
            TO_Y: 'y',
            TO_B: 'b'
          }
        },
        b: {
          on: {
            NEXT_B_TO_X: 'x'
          }
        },
        x: {
          on: {
            NEXT_X_TO_Y: 'y'
          }
        },
        y: {}
      }
    });

    const pathsToB = getShortestPaths(m, {
      toState: (state) => state.matches('b')
    });
    const paths = pathsToB.flatMap((path) => {
      const pathsToY = getShortestPaths(m, {
        fromState: path.state,
        toState: (state) => state.matches('y')
      });

      return pathsToY.map((pathToY) => {
        return joinPaths(path, pathToY);
      });
    });

    expect(paths).toHaveLength(1);
    expect(paths[0].steps.map((s) => s.event.type)).toMatchInlineSnapshot(`
      [
        "xstate.init",
        "TO_B",
        "NEXT_B_TO_X",
        "NEXT_X_TO_Y",
      ]
    `);
  });

  it('handles event cases', () => {
    const machine = createMachine({
      types: {
        events: {} as { type: 'todo.add'; todo: string },
        context: {} as { todos: string[] }
      },
      context: {
        todos: []
      },
      on: {
        'todo.add': {
          actions: assign({
            todos: ({ context, event }) => {
              return context.todos.concat(event.todo);
            }
          })
        }
      }
    });

    const shortestPaths = getShortestPaths(machine, {
      events: [
        {
          type: 'todo.add',
          todo: 'one'
        } as const,
        {
          type: 'todo.add',
          todo: 'two'
        } as const
      ],
      filter: (state) => state.context.todos.length < 3
    });

    const pathWithTwoTodos = shortestPaths.filter(
      (path) =>
        path.state.context.todos.includes('one') &&
        path.state.context.todos.includes('two')
    );

    expect(pathWithTwoTodos).toBeDefined();
  });

  it('should work for machines with delays', () => {
    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          after: {
            1000: 'b'
          }
        },
        b: {}
      }
    });

    const shortestPaths = getShortestPaths(machine);

    expect(shortestPaths.map((p) => p.steps.map((s) => s.event.type))).toEqual([
      ['xstate.init'],
      ['xstate.init', 'xstate.after.1000.(machine).a']
    ]);
  });
});
