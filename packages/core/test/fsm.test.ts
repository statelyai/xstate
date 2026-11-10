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

  it.each([
    ['NaN', { value: NaN }, { value: NaN }, true],
    ['negative zero', { value: 0 }, { value: -0 }, false],
    ['positive zero', { value: -0 }, { value: 0 }, false],
    ['missing undefined key', {}, { value: undefined }, false],
    ['inherited value', {}, { toString: Object.prototype.toString }, false],
    ['equal value', { value: 1 }, { value: 1 }, true],
    ['changed value', { value: 1 }, { value: 2 }, false],
    ['empty patch', { value: 1 }, {}, true]
  ] as const)(
    'applies a %s patch and reuses only unchanged snapshots',
    (_name, context, patch, reused) => {
      const machine = createFSM<Record<string, unknown>, { type: 'set' }>({
        context,
        initial: 'idle',
        states: { idle: { on: { set: { context: patch } } } }
      });
      const [next] = machine.transition(machine.initialState, { type: 'set' });

      expect(next === machine.initialState).toBe(reused);
      const expected: Record<string, unknown> = { ...context, ...patch };
      expect(Object.keys(next.context)).toEqual(Object.keys(expected));
      for (const key of Object.keys(expected)) {
        expect(Object.hasOwn(next.context, key)).toBe(true);
        expect(Object.is(next.context[key], expected[key])).toBe(true);
      }
    }
  );

  it.each([
    'new',
    'undefined',
    'changed',
    'equal',
    'inherited',
    'hidden'
  ] as const)('handles a %s symbol context patch', (kind) => {
    const key = Symbol('count');
    const context = kind === 'equal' || kind === 'changed' ? { [key]: 1 } : {};
    const patch =
      kind === 'inherited'
        ? Object.create({ [key]: 2 })
        : kind === 'hidden'
          ? Object.defineProperty({}, key, { value: 2 })
          : {
              [key]: kind === 'undefined' ? undefined : kind === 'equal' ? 1 : 2
            };
    const machine = createFSM<Record<PropertyKey, unknown>, { type: 'set' }>({
      context,
      initial: 'idle',
      states: { idle: { on: { set: { context: patch } } } }
    });
    const [next] = machine.transition(machine.initialState, { type: 'set' });
    const unchanged =
      kind === 'equal' || kind === 'inherited' || kind === 'hidden';
    expect(next === machine.initialState).toBe(unchanged);
    expect(Object.hasOwn(next.context, key)).toBe(
      !['inherited', 'hidden'].includes(kind)
    );
    if (!unchanged) {
      expect(next.context[key]).toBe(kind === 'undefined' ? undefined : 2);
    }
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

  it('ignores inherited state definitions when resolving transitions', () => {
    const states = Object.create({ b: { on: { back: 'a' } } });
    states.a = { on: { go: 'b' } };

    const machine = createFSM({ initial: 'a', states });

    const [afterGo] = machine.transition(machine.initialState, { type: 'go' });
    expect(afterGo.value).toBe('b');

    const [afterBack, backEffects] = machine.transition(afterGo, {
      type: 'back'
    });
    expect(afterBack.value).toBe('b');
    expect(afterBack).toBe(afterGo);
    expect(backEffects).toEqual([]);
  });

  it('keeps the initial state when the current state is not an own property', () => {
    const states = Object.create({ b: { on: { back: 'a' } } });
    states.a = { on: { go: 'b' } };

    const machine = createFSM({ initial: 'b', states });

    const [next, effects] = machine.transition(machine.initialState, {
      type: 'back'
    });
    expect(next.value).toBe('b');
    expect(next).toBe(machine.initialState);
    expect(effects).toEqual([]);
  });

  it('still resolves transitions for own state properties', () => {
    const states = Object.create({ b: { on: { back: 'a' } } });
    states.a = { on: { go: 'b' } };
    states.b = { on: { back: 'a' } };

    const machine = createFSM({ initial: 'a', states });

    const [afterGo] = machine.transition(machine.initialState, { type: 'go' });
    expect(afterGo.value).toBe('b');

    const [afterBack] = machine.transition(afterGo, { type: 'back' });
    expect(afterBack.value).toBe('a');
  });

  it('supports state maps created with a null prototype', () => {
    const states = Object.create(null);
    states.a = { on: { go: 'b' } };
    states.b = { on: { back: 'a' } };

    const machine = createFSM({ initial: 'a', states });

    const [afterGo] = machine.transition(machine.initialState, { type: 'go' });
    expect(afterGo.value).toBe('b');

    const [afterBack] = machine.transition(afterGo, { type: 'back' });
    expect(afterBack.value).toBe('a');
  });
});
