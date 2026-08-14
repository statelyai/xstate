import { setup, types } from 'xstate';

export interface Item {
  id: string;
  label: string;
  /** Price in cents. */
  price: number;
}

export const items: Item[] = [
  { id: 'cola', label: 'Cola', price: 125 },
  { id: 'chips', label: 'Chips', price: 100 },
  { id: 'gum', label: 'Gum', price: 65 }
];

export const coins = [5, 10, 25, 100];

export interface VendingContext {
  /** Credit inserted so far, in cents. */
  credit: number;
  /** Remaining units per item id. */
  stock: Record<string, number>;
  /** The item currently being dispensed, if any. */
  dispensing: string | null;
  /** Change handed back on the last transaction, in cents. */
  change: number;
  /** Feedback for the shopper. */
  message: string;
}

const priceOf = (id: string) => items.find((item) => item.id === id)!.price;

export const vendingMachine = setup({
  schemas: {
    context: types<VendingContext>(),
    events: {
      insertCoin: types<{ value: number }>(),
      select: types<{ id: string }>(),
      refund: types<{}>()
    }
  },
  guards: {
    inStock: ({
      context,
      event
    }: {
      context: VendingContext;
      event: { id: string };
    }) => context.stock[event.id]! > 0,
    canAfford: ({
      context,
      event
    }: {
      context: VendingContext;
      event: { id: string };
    }) => context.credit >= priceOf(event.id)
  },
  delays: {
    dispenseTime: 1200,
    changeTime: 800
  }
}).createMachine({
  id: 'vendingMachine',
  context: {
    credit: 0,
    stock: { cola: 2, chips: 1, gum: 0 },
    dispensing: null,
    change: 0,
    message: 'Insert coins'
  },
  initial: 'idle',
  states: {
    idle: {
      on: {
        insertCoin: ({ context, event }) => ({
          context: {
            credit: context.credit + event.value,
            change: 0,
            message: 'Insert coins or make a selection'
          }
        }),
        // The guards declared in `setup()` are called explicitly here, so one
        // transition function can choose between three outcomes.
        select: ({ context, event, guards }) => {
          if (!guards.inStock({ context, event })) {
            return { context: { message: 'Sold out' } };
          }

          if (!guards.canAfford({ context, event })) {
            const missing = priceOf(event.id) - context.credit;
            return { context: { message: `Add ${missing}¢ more` } };
          }

          return {
            target: 'dispensing',
            context: {
              credit: context.credit - priceOf(event.id),
              stock: {
                ...context.stock,
                [event.id]: context.stock[event.id]! - 1
              },
              dispensing: event.id,
              message: 'Dispensing…'
            }
          };
        },
        refund: ({ context }) =>
          context.credit === 0 ? undefined : { target: 'returningChange' }
      }
    },
    dispensing: {
      after: {
        dispenseTime: ({ context }) =>
          context.credit > 0
            ? { target: 'returningChange', context: { dispensing: null } }
            : {
                target: 'idle',
                context: { dispensing: null, message: 'Enjoy!' }
              }
      }
    },
    returningChange: {
      entry: ({ context }) => ({
        context: {
          change: context.credit,
          credit: 0,
          message: `Returning ${context.credit}¢`
        }
      }),
      after: {
        changeTime: () => ({
          target: 'idle',
          context: { message: 'Insert coins' }
        })
      }
    }
  }
});
