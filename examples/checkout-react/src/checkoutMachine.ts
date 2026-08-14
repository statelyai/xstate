import { setup, types, createAsyncLogic } from 'xstate';

export type CartItem = { id: string; name: string; price: number };

export type Shipping = { name: string; address: string; city: string };

export type Payment = { cardNumber: string };

export type Receipt = { id: string; total: number };

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const charge = createAsyncLogic({
  schemas: { input: types<{ cardNumber: string; total: number }>() },
  run: async ({ input }): Promise<Receipt> => {
    await sleep(900);

    // The mock processor declines any card ending in 0000.
    if (input.cardNumber.replace(/\s/g, '').endsWith('0000')) {
      throw new Error('Card declined by the issuer.');
    }

    return { id: crypto.randomUUID(), total: input.total };
  }
});

type CheckoutContext = {
  cart: CartItem[];
  shipping: Shipping;
  payment: Payment;
  receipt: Receipt | null;
  error: string | null;
};

const emptyShipping: Shipping = { name: '', address: '', city: '' };

export const total = (cart: CartItem[]) =>
  cart.reduce((sum, item) => sum + item.price, 0);

export const checkoutMachine = setup({
  schemas: {
    context: types<CheckoutContext>(),
    events: {
      addItem: types<{ item: CartItem }>(),
      removeItem: types<{ id: string }>(),
      next: types<{}>(),
      back: types<{}>(),
      editCart: types<{}>(),
      setShipping: types<Shipping>(),
      setPayment: types<Payment>(),
      retry: types<{}>()
    }
  },
  actors: { charge }
}).createMachine({
  id: 'checkout',
  context: {
    cart: [],
    shipping: emptyShipping,
    payment: { cardNumber: '' },
    receipt: null,
    error: null
  },
  initial: 'cart',
  states: {
    cart: {
      on: {
        addItem: ({ context, event }) => ({
          context: { cart: [...context.cart, event.item] }
        }),
        removeItem: ({ context, event }) => ({
          context: { cart: context.cart.filter((i) => i.id !== event.id) }
        }),
        // Returning `undefined` blocks the transition: an empty cart cannot
        // advance. This is what a `guard` used to express in v5.
        next: ({ context }) => {
          if (context.cart.length > 0) {
            return { target: 'shipping' as const };
          }
        }
      }
    },
    shipping: {
      on: {
        setShipping: ({ event }) => ({
          context: {
            shipping: {
              name: event.name,
              address: event.address,
              city: event.city
            }
          }
        }),
        next: ({ context }) => {
          const { name, address, city } = context.shipping;
          if (name && address && city) {
            return { target: 'payment' as const };
          }
        },
        editCart: { target: 'cart' }
      }
    },
    payment: {
      on: {
        setPayment: ({ event }) => ({
          context: { payment: { cardNumber: event.cardNumber } }
        }),
        next: ({ context }) => {
          if (context.payment.cardNumber.replace(/\s/g, '').length >= 12) {
            return { target: 'confirming' as const, context: { error: null } };
          }
        },
        back: { target: 'shipping' },
        editCart: { target: 'cart' }
      }
    },
    confirming: {
      invoke: {
        src: charge,
        input: ({ context }) => ({
          cardNumber: context.payment.cardNumber,
          total: total(context.cart)
        }),
        onDone: ({ event }) => ({
          target: 'done',
          context: { receipt: event.output, error: null }
        }),
        onError: ({ event }) => ({
          target: 'declined',
          context: { error: (event.error as Error).message }
        })
      }
    },
    declined: {
      on: {
        retry: { target: 'payment' },
        editCart: { target: 'cart' }
      }
    },
    done: {
      type: 'final'
    }
  }
});
