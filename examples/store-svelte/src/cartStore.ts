import { createStore } from '@xstate/store';
import { createInspector } from '@statelyai/sdk';

const inspector = createInspector();

export type CartItem = { id: string; name: string; price: number; qty: number };

export const CATALOG: Omit<CartItem, 'qty'>[] = [
  { id: 'mug', name: 'Mug', price: 12 },
  { id: 'tee', name: 'T-shirt', price: 25 },
  { id: 'cap', name: 'Cap', price: 18 }
];

/** One store, imported by every component that needs the cart. */
export const cartStore = createStore({
  context: { items: [] as CartItem[] },
  on: {
    add: (context, event: { id: string }) => {
      const product = CATALOG.find((entry) => entry.id === event.id)!;
      const existing = context.items.find((item) => item.id === event.id);

      return {
        items: existing
          ? context.items.map((item) =>
              item.id === event.id ? { ...item, qty: item.qty + 1 } : item
            )
          : [...context.items, { ...product, qty: 1 }]
      };
    },
    remove: (context, event: { id: string }) => ({
      items: context.items.filter((item) => item.id !== event.id)
    }),
    clear: () => ({ items: [] as CartItem[] })
  }
});

cartStore.inspect(inspector.inspect);
