import {
  createAtom,
  createAtomConfig,
  createStoreHook,
  createStoreLogic,
  useAtom,
  useAtomState,
  useStore
} from './index.ts';
import { z } from 'zod';

describe('@xstate/store-react types', () => {
  it('uses atom config input in useAtomState', () => {
    const countAtom = createAtom(0);
    const countConfig = createAtomConfig(
      (input: { initialCount: number }) => input.initialCount
    );
    const optionalInputConfig = createAtomConfig(
      (_input?: { initialCount?: number }) => 0
    );
    const noInputConfig = createAtomConfig(0);

    const Component = () => {
      const [liveValue, liveAtom] = useAtomState(countAtom);
      liveValue satisfies number;
      liveAtom.set(1);

      const atomValue = useAtom(countConfig, { initialCount: 1 });
      atomValue satisfies number;

      useAtom(optionalInputConfig);
      useAtom(optionalInputConfig, { initialCount: 1 });
      useAtom(noInputConfig);

      useAtomState(
        countConfig,
        // @ts-expect-error required input
        undefined
      );

      const [count, atom] = useAtomState(countConfig, { initialCount: 1 });
      count satisfies number;
      atom.set((prev) => prev + 1);

      useAtomState(countConfig, {
        // @ts-expect-error wrong input
        initialCount: 'one'
      });

      useAtomState(optionalInputConfig);
      useAtomState(optionalInputConfig, { initialCount: 1 });
      useAtomState(noInputConfig);

      useAtomState(
        noInputConfig,
        // @ts-expect-error no input
        {}
      );

      return null;
    };

    Component;
  });

  it('uses store logic input in useStore', () => {
    const counterLogic = createStoreLogic({
      context: (input: { initialCount: number }) => ({
        count: input.initialCount
      }),
      on: {
        inc: (ctx) => ({ count: ctx.count + 1 })
      }
    });
    const optionalInputLogic = createStoreLogic({
      context: (_input?: { initialCount?: number }) => ({ count: 0 }),
      on: {}
    });
    const noInputLogic = createStoreLogic({
      context: { count: 0 },
      on: {}
    });

    const Component = () => {
      // @ts-expect-error required input
      useStore(counterLogic);

      // @ts-expect-error required input
      useStore(counterLogic, undefined);

      const store = useStore(counterLogic, { initialCount: 1 });
      store.getSnapshot().context.count satisfies number;

      // @ts-expect-error wrong input
      useStore(counterLogic, { initialCount: 'one' });

      useStore(optionalInputLogic);
      useStore(optionalInputLogic, { initialCount: 1 });
      useStore(noInputLogic);

      // @ts-expect-error no input
      useStore(noInputLogic, {});

      return null;
    };

    Component;
  });

  it('infers schemas in useStore', () => {
    const Component = () => {
      const store = useStore({
        schemas: {
          context: z.object({ count: z.number(), label: z.string() }),
          events: {
            rename: z.object({ label: z.string() })
          },
          emitted: {
            renamed: z.object({ label: z.string() })
          }
        },
        context: {
          count: 0,
          label: 'ready'
        },
        on: {
          rename: (
            ctx: { count: number; label: string },
            ev: { label: string }
          ) => {
            return {
              ...ctx,
              label: ev.label
            };
          }
        }
      });

      store.getSnapshot().context.label satisfies string;
      store.trigger.rename({ label: 'done' });

      store.on('renamed', (event) => {
        event.label satisfies string;
      });

      if (false) {
        store.trigger.rename(
          // @ts-expect-error
          {}
        );

        store.on(
          // @ts-expect-error
          'unknown',
          () => {}
        );
      }

      return null;
    };
  });

  it('preserves inferred events when only emitted schemas are declared in useStore', () => {
    const Component = () => {
      const store = useStore({
        schemas: {
          emitted: {
            logged: z.object({ message: z.string() })
          }
        },
        context: {},
        on: {
          log: (ctx: {}, ev: { message: string }) => {
            return ctx;
          }
        }
      });

      store.trigger.log({ message: 'hello' });

      if (false) {
        store.trigger.log(
          // @ts-expect-error
          {}
        );

        // @ts-expect-error
        store.trigger.unknown();
      }

      return null;
    };
  });

  it('infers schemas in createStoreHook', () => {
    const useCounterStore = createStoreHook({
      schemas: {
        context: z.object({ count: z.number(), label: z.string() }),
        events: {
          rename: z.object({ label: z.string() })
        },
        emitted: {
          renamed: z.object({ label: z.string() })
        }
      },
      context: {
        count: 0,
        label: 'ready'
      },
      on: {
        rename: (
          ctx: { count: number; label: string },
          ev: { label: string }
        ) => {
          return {
            ...ctx,
            label: ev.label
          };
        }
      }
    });

    const Component = () => {
      const [snapshot, store] = useCounterStore();
      const [label] = useCounterStore((state) => state.context.label);

      snapshot.context.label satisfies string;
      label satisfies string;

      store.trigger.rename({ label: 'done' });
      store.on('renamed', (event) => {
        event.label satisfies string;
      });

      if (false) {
        store.trigger.rename(
          // @ts-expect-error
          {}
        );

        store.on(
          // @ts-expect-error
          'unknown',
          () => {}
        );
      }

      return null;
    };
  });
});
