import { useStore } from './index.ts';
import { z } from 'zod';

describe('@xstate/store-svelte types', () => {
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
