import { createAsyncLogic, createMachine } from '../src/index.ts';
import { createFSM } from '../src/fsm/index.ts';

const child = createAsyncLogic({ run: async () => 1 });

function message(name: string, state = 'a') {
  return `Transition for "${name}" in state "${state}" is the string "b". Use { target: 'b' }. The @xstate/codemod string-targets transform rewrites these.`;
}

function create(a: Record<string, unknown>) {
  return () =>
    createMachine({
      initial: 'a',
      states: { a, b: {} }
    } as any);
}

describe('bare string transition targets', () => {
  it.each([
    ['GO', { on: { GO: 'b' } }],
    ['after.100', { after: { 100: 'b' } }],
    ['always', { always: 'b' }],
    ['onDone', { initial: 'c', states: { c: { type: 'final' } }, onDone: 'b' }],
    ['onError', { onError: 'b' }],
    ['onTimeout', { timeout: 100, onTimeout: 'b' }],
    ['invoke.onDone', { invoke: { src: child, onDone: 'b' } }],
    ['invoke.onError', { invoke: { src: child, onError: 'b' } }],
    ['invoke.onSnapshot', { invoke: { src: child, onSnapshot: 'b' } }],
    [
      'invoke.onTimeout',
      { invoke: { src: child, timeout: 100, onTimeout: 'b' } }
    ]
  ])('throw for %s', (name, config) => {
    expect(create(config)).toThrow(message(name));
  });

  it('throw on the root of a machine without an id', () => {
    expect(() =>
      createMachine({
        on: { GO: 'b' },
        initial: 'a',
        states: { a: {}, b: {} }
      } as any)
    ).toThrow(
      `Transition for "GO" in the root state is the string "b". Use { target: 'b' }.`
    );
  });

  it('are still accepted by xstate/fsm', () => {
    const fsm = createFSM({
      initial: 'a',
      states: { a: { on: { GO: 'b' } }, b: {} }
    });
    const [next] = fsm.transition(fsm.getInitialSnapshot(), { type: 'GO' });
    expect(next.value).toBe('b');
  });
});
