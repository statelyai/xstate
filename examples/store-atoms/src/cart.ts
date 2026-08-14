import { createAtom, createStore } from '@xstate/store';

export interface Item {
  id: string;
  name: string;
  price: number;
  qty: number;
}

/** A plain writable atom. Read with `.get()`, write with `.set()`. */
export const taxRateAtom = createAtom(0.08);

/** Another writable atom, used below to build a computed one. */
export const promoAtom = createAtom<string | null>(null);

export const cartStore = createStore({
  context: {
    items: [
      { id: 'mug', name: 'Mug', price: 12, qty: 1 },
      { id: 'tee', name: 'T-shirt', price: 25, qty: 2 }
    ] as Item[]
  },
  on: {
    add: (context, event: { id: string }) => ({
      items: context.items.map((item) =>
        item.id === event.id ? { ...item, qty: item.qty + 1 } : item
      )
    }),
    remove: (context, event: { id: string }) => ({
      items: context.items
        .map((item) =>
          item.id === event.id ? { ...item, qty: item.qty - 1 } : item
        )
        .filter((item) => item.qty > 0)
    })
  }
});

/**
 * `store.select(…)` returns an atom over the store's context, so store state
 * and standalone atoms compose in the same graph.
 */
export const subtotalAtom = cartStore.select((context) =>
  context.items.reduce((total, item) => total + item.price * item.qty, 0)
);

/**
 * A computed atom: pass a getter instead of a value. Every atom read inside
 * the getter becomes a dependency, so this recomputes when the cart changes,
 * when the tax rate changes, or when a promo code is applied.
 */
export const discountAtom = createAtom(() =>
  promoAtom.get() === 'HALFOFF' ? subtotalAtom.get() / 2 : 0
);

export const totalAtom = createAtom(
  () => (subtotalAtom.get() - discountAtom.get()) * (1 + taxRateAtom.get())
);
