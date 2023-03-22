import { assign, createMachine } from 'xstate';
import { flatten } from 'xstate/lib/utils';
import { joinPaths } from '../src/graph';
import { getMachineShortestPaths } from '../src/shortestPaths';

describe('getMachineShortestPaths', () => {
  it('finds the shortest paths to a state without continuing traversal from that state', () => {
    const m = createMachine<{ count: number }>({
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
                count: (ctx) => ctx.count + 1
              })
            }
          }
        }
      }
    });

    const p = getMachineShortestPaths(m, {
      toState: (state) => state.matches('c')
    });

    expect(p).toHaveLength(1);
    expect(p[0].state.matches('c')).toBeTruthy();
  });

  it('finds the shortest paths from a state to another state', () => {
    const m = createMachine<{ count: number }>({
      initial: 'a',
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

    const pathsToB = getMachineShortestPaths(m, {
      toState: (state) => state.matches('b')
    });
    const paths = flatten(
      pathsToB.map((path) => {
        const pathsToY = getMachineShortestPaths(m, {
          fromState: path.state,
          toState: (state) => state.matches('y')
        });

        return pathsToY.map((pathToY) => {
          return joinPaths(path, pathToY);
        });
      })
    );

    expect(paths).toHaveLength(1);
    expect(paths[0].steps.map((s) => s.event.type)).toMatchInlineSnapshot(`
      Array [
        "TO_B",
        "NEXT_B_TO_X",
        "NEXT_X_TO_Y",
      ]
    `);
  });

  it('handles event cases', () => {
    const machine = createMachine({
      schema: {
        events: {} as { type: 'todo.add'; todo: string },
        context: {} as { todos: string[] }
      },
      context: {
        todos: []
      },
      on: {
        'todo.add': {
          actions: assign({
            todos: (ctx, ev) => {
              return ctx.todos.concat(ev.todo);
            }
          })
        }
      }
    });

    const shortestPaths = getMachineShortestPaths(machine, {
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
});
