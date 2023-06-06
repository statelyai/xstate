import { createMachine } from '../src';

describe('matches', () => {
  it('should allow matches to be called multiple times in a single branch of code', () => {
    const machine = createMachine<{ count: number }>({
      initial: 'a',
      states: { a: {} }
    });
    const state = machine.initialState;

    if (state.matches('idle')) {
      ((_accept: number) => {})(state.context.count);
      // @ts-expect-error
      ((_accept: string) => {})(state.context.count);
    } else if (state.matches('latest')) {
      ((_accept: number) => {})(state.context.count);
      // @ts-expect-error
      ((_accept: string) => {})(state.context.count);
    }
  });

  it('should narrow context using typestates', () => {
    type MyContext = { user: { name: string } | null; count: number };
    type Typestates =
      | {
          value: 'idle';
          context: { user: null; count: number };
        }
      | {
          value: 'fetched';
          context: { user: { name: string }; count: number };
        };
    const machine = createMachine<MyContext, { type: string }, Typestates>({
      initial: 'idle',
      states: { idle: {}, fetched: {} }
    });
    const state = machine.initialState;

    if (state.matches('idle')) {
      ((_accept: null) => {})(state.context.user);
      // @ts-expect-error
      ((_accept: { name: string }) => {})(state.context.user);

      ((_accept: number) => {})(state.context.count);
      // @ts-expect-error
      ((_accept: string) => {})(state.context.count);
    } else if (state.matches('fetched')) {
      // @ts-expect-error
      ((_accept: null) => {})(state.context.user);
      ((_accept: { name: string }) => {})(state.context.user);

      ((_accept: number) => {})(state.context.count);
      // @ts-expect-error
      ((_accept: string) => {})(state.context.count);
    }
  });
});
