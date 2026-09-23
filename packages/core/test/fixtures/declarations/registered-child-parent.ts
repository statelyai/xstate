import { setup, types } from '../../../src/index.ts';
import { childMachine } from './registered-child.ts';

export const parentMachine = setup({
  schemas: {
    context: types<{ f0: string }>(),
    events: {
      e0: types<{ value: string }>(),
      e1: types<{ value: string }>(),
      e2: types<{ value: string }>(),
      e3: types<{ value: string }>(),
      e4: types<{ value: string }>(),
      e5: types<{ value: string }>(),
      e6: types<{ value: string }>(),
      e7: types<{ value: string }>(),
      e8: types<{ value: string }>(),
      e9: types<{ value: string }>(),
      e10: types<{ value: string }>()
    }
  },
  actors: { child: childMachine }
}).createMachine({
  context: { f0: '' },
  initial: 's0',
  states: {
    s0: {
      on: {
        e0: ({ context, event, actors }, enq) => {
          event.value satisfies string;
          const fromKey = enq.spawn('child', { input: { token: 'key' } });
          const fromLogic = enq.spawn(actors.child, {
            input: { token: 'logic' }
          });
          // @ts-expect-error The child's token must be a string.
          enq.spawn(actors.child, { input: { token: 42 } });
          fromKey.getSnapshot().context.f00 satisfies string;
          fromLogic.getSnapshot().value satisfies 'c0' | 'c1' | 'c2';
          return { target: 's1' as const, context };
        },
        e1: ({ context }) => ({ target: 's0' as const, context }),
        e2: ({ context }) => ({ target: 's1' as const, context }),
        e3: ({ context }) => ({ target: 's0' as const, context }),
        e4: ({ context }) => ({ target: 's1' as const, context }),
        e5: ({ context }) => ({ target: 's0' as const, context }),
        e6: ({ context }) => ({ target: 's1' as const, context }),
        e7: ({ context }) => ({ target: 's0' as const, context }),
        e8: ({ context }) => ({ target: 's1' as const, context }),
        e9: ({ context }) => ({ target: 's0' as const, context }),
        e10: ({ context }) => ({ target: 's1' as const, context })
      }
    },
    s1: {
      on: {
        e0: ({ context }) => ({ target: 's0' as const, context }),
        e1: ({ context }) => ({ target: 's1' as const, context }),
        e2: ({ context }) => ({ target: 's0' as const, context }),
        e3: ({ context }) => ({ target: 's1' as const, context }),
        e4: ({ context }) => ({ target: 's0' as const, context }),
        e5: ({ context }) => ({ target: 's1' as const, context }),
        e6: ({ context }) => ({ target: 's0' as const, context }),
        e7: ({ context }) => ({ target: 's1' as const, context }),
        e8: ({ context }) => ({ target: 's0' as const, context }),
        e9: ({ context }) => ({ target: 's1' as const, context }),
        e10: ({ context }) => ({ target: 's0' as const, context })
      }
    }
  }
});
