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

    const [next, effects] = machine.transition(machine.initialState, {
      type: 'toggle'
    });

    expect(next).toEqual({ status: 'active', value: 'on', context: {} });
    expect(effects).toEqual([]);
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

    const [next] = machine.transition(machine.initialState, {
      type: 'increment',
      by: 2
    });

    expect(next).toEqual({
      status: 'active',
      value: 'ready',
      context: { count: 2 }
    });
  });

  it('preserves snapshot identity for no-op context patches', () => {
    const machine = createFSM<{ count: number }, { type: 'noop' }>({
      context: { count: 0 },
      initial: 'idle',
      states: {
        idle: { on: { noop: { context: { count: 0 } } } }
      }
    });

    expect(machine.transition(machine.initialState, { type: 'noop' })[0]).toBe(
      machine.initialState
    );
  });

  it('applies an own undefined property when it is absent from context', () => {
    const machine = createFSM<{ extra?: undefined }>({
      context: {},
      initial: 'idle',
      states: { idle: { on: { patch: { context: { extra: undefined } } } } }
    });

    const [next] = machine.transition(machine.initialState, { type: 'patch' });

    expect(Object.hasOwn(next.context, 'extra')).toBe(true);
  });

  it('detects signed zero changes and preserves identity for NaN', () => {
    const machine = createFSM<{ zero: number; value: number }>({
      context: { zero: 0, value: NaN },
      initial: 'idle',
      states: {
        idle: {
          on: {
            changeZero: { context: { zero: -0 } },
            keepNaN: { context: { value: NaN } }
          }
        }
      }
    });

    const [changed] = machine.transition(machine.initialState, {
      type: 'changeZero'
    });
    expect(changed.context.zero).toBe(-0);
    expect(
      machine.transition(machine.initialState, { type: 'keepNaN' })[0]
    ).toBe(machine.initialState);
  });

  it('applies enumerable symbol properties in a context patch', () => {
    const key = Symbol('key');
    const machine = createFSM<{ [key]: number }>({
      context: { [key]: 0 },
      initial: 'idle',
      states: { idle: { on: { patch: { context: { [key]: 1 } } } } }
    });

    const [next] = machine.transition(machine.initialState, { type: 'patch' });

    expect(next.context[key]).toBe(1);
  });

  it('applies only own context patch keys', () => {
    const machine = createFSM<
      { count: number; inherited?: number },
      { type: 'inherited' } | { type: 'own' }
    >({
      context: { count: 0 },
      initial: 'idle',
      states: {
        idle: {
          on: {
            inherited: () => ({ context: Object.create({ inherited: 1 }) }),
            own: () => ({ context: { count: 1 } })
          }
        }
      }
    });

    expect(
      machine.transition(machine.initialState, { type: 'inherited' })[0]
    ).toBe(machine.initialState);

    const [next] = machine.transition(machine.initialState, { type: 'own' });
    expect(next).not.toBe(machine.initialState);
    expect(next.context).toEqual({ count: 1 });
  });

  it('ignores inherited event names', () => {
    const machine = createFSM({
      initial: 'idle',
      states: { idle: { on: { ping: 'idle' } } }
    });

    expect(
      machine.transition(machine.initialState, { type: 'constructor' })[0]
    ).toBe(machine.initialState);
  });

  it('materializes output and error as own snapshot properties', () => {
    const machine = createFSM({
      initial: 'inactive',
      context: { count: 0 },
      states: {
        inactive: { on: { toggle: 'active' } },
        active: {}
      }
    });
    const keys = ['status', 'value', 'context', 'output', 'error'];
    const [next] = machine.transition(machine.initialState, {
      type: 'toggle'
    });

    for (const snapshot of [
      machine.initialState,
      machine.getInitialSnapshot(),
      next
    ]) {
      expect(Object.keys(snapshot)).toEqual(keys);
      const roundTripped = JSON.parse(
        JSON.stringify(snapshot, (_, value) =>
          value === undefined ? null : value
        )
      );
      expect(Object.keys(roundTripped)).toEqual(keys);
    }
  });
});
