import { createActor } from '../src/createActor.ts';
import { createFSM, setup } from '../src/fsm.ts';
import { types } from '../src/schema.types.ts';

describe('compact FSM eventless transitions', () => {
  it('settles initialization through string and object targets', () => {
    const machine = createFSM({
      initial: 'first',
      states: {
        first: { always: { target: 'second' } },
        second: { always: { target: 'ready' } },
        ready: {}
      }
    });
    expect(machine.initialState.value).toBe('ready');
    expect(machine.getInitialSnapshot()).toBe(machine.initialState);
    expect(machine.initialTransition()).toEqual([machine.initialState, []]);
  });

  it('rechecks context-only steps and preserves the original snapshot', () => {
    const machine = createFSM<{ count: number }, { type: 'RUN' }>({
      context: { count: 0 },
      initial: 'idle',
      states: {
        idle: { on: { RUN: { target: 'counting' } } },
        counting: {
          always: ({ context }) =>
            context.count < 3
              ? { context: { count: context.count + 1 } }
              : { target: 'done' }
        },
        done: {}
      }
    });
    const [next, effects] = machine.transition(machine.initialState, {
      type: 'RUN'
    });
    expect(next.value).toBe('done');
    expect(next.context).toEqual({ count: 3 });
    expect(machine.initialState.context).toEqual({ count: 0 });
    expect(effects).toEqual([]);
  });

  it('passes the triggering event and an initialization event', () => {
    const seen: string[] = [];
    const machine = createFSM<
      { count: number },
      { type: 'SET'; count: number }
    >({
      context: { count: 0 },
      initial: 'idle',
      states: {
        idle: {
          on: { SET: { target: 'idle' } },
          always: ({ event }) => {
            seen.push(event.type);
            if (event.type === 'SET') {
              return { target: 'done', context: { count: event.count } };
            }
          }
        },
        done: {}
      }
    });
    const [next] = machine.transition(machine.initialState, {
      type: 'SET',
      count: 42
    });
    expect(next.context.count).toBe(42);
    expect(seen).toEqual(['xstate.init', 'SET']);
  });

  it('does not rerun always after ignored or declined events', () => {
    const always = vi.fn(() => undefined);
    const machine = createFSM({
      initial: 'idle',
      states: { idle: { always, on: { DECLINE: () => undefined } } }
    });
    expect(
      machine.transition(machine.initialState, { type: 'UNKNOWN' })[0]
    ).toBe(machine.initialState);
    expect(
      machine.transition(machine.initialState, { type: 'DECLINE' })[0]
    ).toBe(machine.initialState);
    expect(always).toHaveBeenCalledTimes(1);
  });

  it('detects always on non-enumerable own state definitions', () => {
    const states = {
      checking: { always: { target: 'ready' } },
      ready: {}
    };
    Object.defineProperty(states, 'checking', { enumerable: false });
    const machine = createFSM<{}>({ initial: 'checking', states });
    expect(machine.initialState.value).toBe('ready');
  });

  it('detects an always transition targeting the empty state name', () => {
    const machine = createFSM({
      initial: 'checking',
      states: { checking: { always: { target: '' } }, '': {} }
    });
    expect(machine.initialState.value).toBe('');
  });

  it('does not read inherited state configurations', () => {
    const machine = createFSM({
      initial: 'inherited',
      states: Object.create({ inherited: { always: { target: 'done' } } })
    });
    expect(machine.initialState.value).toBe('inherited');
  });

  it('settles a long initialization chain without a transition-count limit', () => {
    const machine = createFSM<{ count: number }>({
      initial: 'counting',
      context: { count: 0 },
      states: {
        counting: {
          always: ({ context }) =>
            context.count < 10_000
              ? { context: { count: context.count + 1 } }
              : undefined
        }
      }
    });
    expect(machine.initialState.context.count).toBe(10_000);
  });

  it('settles a long event-triggered chain without a transition-count limit', () => {
    const machine = createFSM<{ count: number }, { type: 'RUN' }>({
      initial: 'idle',
      context: { count: 0 },
      states: {
        idle: { on: { RUN: { target: 'counting' } } },
        counting: {
          always: ({ context }) =>
            context.count < 10_000
              ? { context: { count: context.count + 1 } }
              : undefined
        }
      }
    });
    const [next] = machine.transition(machine.initialState, { type: 'RUN' });
    expect(next.context.count).toBe(10_000);
    expect(machine.initialState.context.count).toBe(0);
  });

  it('exposes only settled actor snapshots', () => {
    const machine = createFSM({
      initial: 'idle',
      states: {
        idle: { on: { RUN: { target: 'transient' } } },
        transient: { always: { target: 'done' } },
        done: {}
      }
    });
    const actor = createActor(machine);
    const seen: string[] = [];
    actor.subscribe((snapshot) => seen.push(snapshot.value));
    actor.start();
    actor.send({ type: 'RUN' });
    expect(seen).toEqual(['idle', 'done']);
    actor.stop();
  });

  it('preserves setup state-specific context and required target patches', () => {
    const app = setup({
      schemas: { events: { GO: types<{}>() } },
      states: {
        loading: { schemas: { context: types<{ status: 'loading' }>() } },
        ready: {
          schemas: { context: types<{ status: 'ready'; result: string }>() }
        }
      }
    });
    const machine = app.createFSM({
      initial: 'loading',
      context: { status: 'loading' },
      states: {
        loading: {
          always: ({ context }) => {
            context.status satisfies 'loading';
            return {
              target: 'ready',
              context: { status: 'ready', result: 'ok' }
            };
          }
        },
        ready: {}
      }
    });
    expect(machine.initialState.value).toBe('ready');
    if (machine.initialState.value === 'ready') {
      machine.initialState.context.result satisfies string;
    }
    if (false) {
      app.createFSM({
        initial: 'loading',
        context: { status: 'loading' },
        states: {
          // @ts-expect-error ready requires a result and a ready status
          loading: { always: { target: 'ready' } },
          ready: {}
        }
      });
    }
  });
});
