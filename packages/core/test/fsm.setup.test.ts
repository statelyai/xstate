import { setup, types } from '../src/fsm/index.ts';

type User = { id: string };
type LoadingContext = { status: 'loading' };
type LoadedContext = { status: 'loaded'; user: User };

describe('xstate/fsm setup', () => {
  it('uses schemas for typed events and correlated state snapshots', () => {
    const app = setup({
      schemas: {
        context: types<LoadingContext | LoadedContext>(),
        events: {
          resolve: types<{ user: User }>(),
          reset: types<{}>(),
          retry: types<{}>(),
          load: types<{}>()
        }
      },
      states: {
        loading: { schemas: { context: types<LoadingContext>() } },
        loaded: { schemas: { context: types<LoadedContext>() } }
      }
    });

    const machine = app.createFSM({
      initial: 'loading',
      context: { status: 'loading' },
      states: {
        loading: {
          on: {
            resolve: ({ event }) => ({
              target: 'loaded',
              context: {
                status: 'loaded' as const,
                user: event.user
              }
            }),
            reset: { context: { status: 'loading' as const } },
            retry: 'loading',
            load: {
              target: 'loaded',
              context: {
                status: 'loaded' as const,
                user: { id: 'static' }
              }
            }
          }
        },
        loaded: {
          on: {
            reset: ({ context }) => ({
              target: 'loading',
              context: { status: 'loading' as const }
            })
          }
        }
      }
    });

    expect(machine.initialState).toEqual({
      value: 'loading',
      context: { status: 'loading' }
    });

    expect(machine.transition(machine.initialState, { type: 'retry' })).toEqual(
      {
        value: 'loading',
        context: { status: 'loading' }
      }
    );

    expect(machine.transition(machine.initialState, { type: 'load' })).toEqual({
      value: 'loaded',
      context: { status: 'loaded', user: { id: 'static' } }
    });

    const next = machine.transition(machine.initialState, {
      type: 'resolve',
      user: { id: '1' }
    });

    expect(next).toEqual({
      value: 'loaded',
      context: { status: 'loaded', user: { id: '1' } }
    });

    if (next.value === 'loaded') {
      expect(next.context.user.id).toBe('1');
      // @ts-expect-error loaded state context has no loading-only shape
      next.context.status satisfies 'loading';
    }

    // @ts-expect-error undeclared event
    machine.transition(machine.initialState, { type: 'unknown' });
    // @ts-expect-error event payload must match its schema
    machine.transition(machine.initialState, { type: 'resolve', user: 1 });
  });

  it('requires context when entering a state with a different schema', () => {
    const app = setup({
      states: {
        loading: { schemas: { context: types<LoadingContext>() } },
        loaded: { schemas: { context: types<LoadedContext>() } }
      }
    });

    // @ts-expect-error a declared context schema makes initial context required
    app.createFSM({
      initial: 'loading',
      states: { loading: {}, loaded: {} }
    });

    app.createFSM({
      initial: 'loading',
      context: { status: 'loading' },
      states: {
        loading: {
          on: {
            // @ts-expect-error a string target cannot retain incompatible context
            finish: 'loaded'
          }
        },
        loaded: {}
      }
    });

    app.createFSM({
      initial: 'loading',
      context: { status: 'loading' },
      states: {
        loading: {
          on: {
            // @ts-expect-error target context is missing the required user
            finish: {
              target: 'loaded',
              context: { status: 'loaded' }
            }
          }
        },
        loaded: {}
      }
    });

    app.createFSM({
      initial: 'loading',
      context: { status: 'loading' },
      states: {
        loading: {
          on: {
            // @ts-expect-error function transitions must provide target context
            finish: () => ({ target: 'loaded' })
          }
        },
        loaded: {}
      }
    });
  });
});
