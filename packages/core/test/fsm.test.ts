import { createFSM } from '../src/fsm.ts';

describe('createFSM', () => {
  it('transitions through a flat event table', () => {
    const machine = createFSM({
      initial: 'off',
      states: {
        off: { on: { toggle: 'on' } },
        on: { on: { toggle: 'off' } }
      }
    });

    const next = machine.transition(machine.initialState, { type: 'toggle' });

    expect(next).toEqual({ value: 'on', context: {} });
  });

  it('supports pure function transitions with context updates', () => {
    const machine = createFSM<
      { count: number },
      { type: 'increment'; by: number }
    >({
      context: { count: 0 },
      initial: 'idle',
      states: {
        idle: {
          on: {
            increment: ({ context, event }) => ({
              target: event.by > 0 ? 'ready' : undefined,
              context: { count: context.count + event.by }
            })
          }
        },
        ready: {}
      }
    });

    const next = machine.transition(machine.initialState, {
      type: 'increment',
      by: 2
    });

    expect(next).toEqual({ value: 'ready', context: { count: 2 } });
  });

  it('ignores inherited event names', () => {
    const machine = createFSM({
      initial: 'idle',
      states: { idle: {} }
    });

    expect(
      machine.transition(machine.initialState, { type: 'constructor' })
    ).toBe(machine.initialState);
  });
});
