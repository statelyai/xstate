import { createMachine, types } from 'xstate';
import { pick as graphPick, testPaths as graphTestPaths } from 'xstate/graph';
import { pick, propertyTest, testPaths } from '../src/index.ts';
import { expectTypeOf, it } from 'vitest';

const cartMachine = createMachine({
  schemas: {
    context: types<{ items: Record<string, number> }>(),
    events: {
      ADD: types<{ sku: string }>(),
      REMOVE: types<{ sku: string }>()
    }
  },
  context: { items: {} }
});

it('infers the snapshot and checks the payload of pick()', () => {
  if (false) {
    void propertyTest(cartMachine, {
      events: {
        REMOVE: pick(
          (snapshot) => {
            expectTypeOf(snapshot.context.items).toEqualTypeOf<
              Record<string, number>
            >();
            return Object.keys(snapshot.context.items);
          },
          (sku, snapshot) => {
            expectTypeOf(sku).toEqualTypeOf<string>();
            expectTypeOf(snapshot.context.items).toEqualTypeOf<
              Record<string, number>
            >();
            return { sku };
          }
        ),
        ADD: pick((snapshot) =>
          Object.keys(snapshot.context.items).map((sku) => ({ sku }))
        )
      }
    });
    void testPaths(cartMachine, {
      events: {
        REMOVE: pick(
          (snapshot) => Object.keys(snapshot.context.items),
          (sku) => ({ sku })
        )
      }
    });
    void graphTestPaths(cartMachine, {
      events: {
        REMOVE: graphPick(
          (snapshot) => Object.keys(snapshot.context.items),
          (sku) => ({ sku })
        )
      }
    });
    void propertyTest(cartMachine, {
      events: {
        // @ts-expect-error the payload must match the REMOVE event
        REMOVE: pick(
          (snapshot) => Object.keys(snapshot.context.items),
          (sku) => ({ item: sku })
        )
      }
    });
  }
});

it('types the resolved descriptor', () => {
  const descriptor = pick(
    (
      snapshot: { context: { items: string[] } } & ReturnType<
        typeof cartMachine.getInitialSnapshot
      >
    ) => snapshot.context.items,
    (sku) => ({ sku })
  );
  expectTypeOf(descriptor.resolve).parameter(0).toMatchTypeOf<{
    generated: number;
  }>();
  expectTypeOf(descriptor.resolve).returns.toEqualTypeOf<
    { sku: string } | undefined
  >();
});
