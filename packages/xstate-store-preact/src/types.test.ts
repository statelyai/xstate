import {
  createAtom,
  createAtomConfig,
  useAtom,
  useAtomState,
  useStore
} from './index.ts';
import { z } from 'zod';

describe('@xstate/store-preact types', () => {
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
            ev: { label: string },
            enq
          ) => {
            enq.emit.renamed({ label: ev.label });
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

      store.trigger.rename(
        // @ts-expect-error
        {}
      );

      store.on(
        // @ts-expect-error
        'unknown',
        () => {}
      );

      return null;
    };

    Component;
  });
});
