import { z } from 'zod';
import { createActor, createMachine, setup, types } from '../src';

it('rejects undeclared context keys in callbacks, patches and snapshots', () => {
  const s = setup({
    schemas: {
      context: z.object({ qty: z.number(), name: z.string().nullable() }),
      events: { add: z.object({}), clear: z.object({}), open: z.object({}) }
    },
    guards: {
      allowed: ({ context }) => {
        // @ts-expect-error schema context has no qtty
        context.qtty;
        return context.qty > 0;
      }
    }
  });
  const machine = s.createMachine({
    context: { qty: 0, name: null },
    initial: 'open',
    states: {
      open: {
        entry: ({ context, self }) => {
          // @ts-expect-error schema context has no qtty
          context.qtty;
          // @ts-expect-error self snapshots preserve the context schema
          self.getSnapshot().context.qtty;
          return { context: { qty: context.qty + 1 } };
        },
        exit: ({ context }) => {
          // @ts-expect-error schema context has no qtty
          context.qtty;
        },
        on: {
          add: ({ context, self }) => {
            // @ts-expect-error schema context has no qtty
            context.qtty;
            // @ts-expect-error self snapshots preserve the context schema
            self.getSnapshot().context.qtty;
            return { context: { qty: context.qty + 1 } };
          },
          // @ts-expect-error function patches reject undeclared keys
          clear: () => ({ context: { qtty: 0 } }),
          // @ts-expect-error object patches reject undeclared keys
          open: { context: { qtty: 0 } }
        }
      }
    }
  });
  const snapshot = createActor(machine).getSnapshot();
  snapshot.context.qty satisfies number;
  // @ts-expect-error snapshots preserve the context schema
  snapshot.context.qtty;
});

it('preserves root and state context schemas in nested states and matches', () => {
  const machine = setup({
    schemas: { context: types<{ qty: number; name: string | null }>() },
    states: {
      ready: {
        schemas: { context: types<{ name: string }>() },
        states: { child: {} }
      }
    }
  }).createMachine({
    context: { qty: 0, name: 'Ada' },
    initial: 'ready',
    states: {
      ready: {
        initial: 'child',
        states: {
          child: {
            entry: ({ context }) => {
              context.qty satisfies number;
              context.name satisfies string;
              // @ts-expect-error inherited state context has no qtty
              context.qtty;
            }
          }
        }
      }
    }
  });
  const snapshot = createActor(machine).getSnapshot();
  if (snapshot.matches({ ready: 'child' })) {
    snapshot.context.name satisfies string;
    // @ts-expect-error narrowing does not introduce an index signature
    snapshot.context.qtty;
  }

  const inlineMachine = createMachine({
    schemas: { context: types<{ qty: number; name: string | null }>() },
    context: { qty: 0, name: 'Ada' },
    initial: 'ready',
    states: {
      ready: { schemas: { context: types<{ name: string }>() } }
    }
  });
  const inlineSnapshot = createActor(inlineMachine).getSnapshot();
  if (inlineSnapshot.matches('ready')) {
    inlineSnapshot.context.name satisfies string;
    // @ts-expect-error inline state schemas preserve declared context keys
    inlineSnapshot.context.qtty;
  }
});

it('supports interface contexts and contexts without schemas', () => {
  interface Context {
    qty: number;
  }
  const machine = setup({
    schemas: { context: types<Context>() }
  }).createMachine({
    context: { qty: 0 },
    entry: ({ context }) => ({ context: { qty: context.qty + 1 } })
  });
  createActor(machine).getSnapshot().context.qty satisfies number;
  setup().createMachine({
    entry: ({ context }) => ({ context: { free: context.anyKey } })
  });
});
