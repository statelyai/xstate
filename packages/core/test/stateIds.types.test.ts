import { createActor, createMachine } from '../src/index.ts';

describe('StateId', () => {
  it('derives paths without a machine id', () => {
    const machine = createMachine({
      initial: 'checkout',
      states: { checkout: { initial: 'payment', states: { payment: {} } } }
    });
    const snapshot = createActor(machine).getSnapshot();

    snapshot.matches('#checkout');
    snapshot.matches('#checkout.payment');
    // Type-only: these would throw at runtime.
    void (() => {
      // @ts-expect-error the root of a machine without an id has no `#id`
      snapshot.matches('#');
      // @ts-expect-error there is no `(machine)` prefix
      snapshot.matches('#(machine).checkout');
    });
    snapshot.getMeta()[''];
    snapshot.getMeta()['checkout.payment'];
  });

  it('derives paths prefixed by the machine id', () => {
    const machine = createMachine({
      id: 'shop',
      initial: 'checkout',
      states: { checkout: { initial: 'payment', states: { payment: {} } } }
    });
    const snapshot = createActor(machine).getSnapshot();

    snapshot.matches('#shop');
    snapshot.matches('#shop.checkout.payment');
    void (() => {
      // @ts-expect-error ids start with the machine id
      snapshot.matches('#checkout');
    });
    machine.id satisfies 'shop';
  });

  it('types the id of a machine without one as the empty string', () => {
    const machine = createMachine({});
    machine.id satisfies '';
  });

  it('accepts implicit `#` targets', () => {
    createMachine({
      initial: 'idle',
      states: {
        idle: {
          on: {
            NESTED: { target: '#checkout.payment' },
            PARENT: { target: '#checkout' },
            REGION: { target: '#p.left.x' }
          }
        },
        checkout: { initial: 'cart', states: { cart: {}, payment: {} } },
        p: {
          type: 'parallel',
          states: {
            left: { initial: 'x', states: { x: {} } },
            right: { initial: 'x', states: { x: {} } }
          }
        }
      }
    });

    createMachine({
      id: 'shop',
      initial: 'idle',
      states: {
        idle: {
          on: {
            ROOT: { target: '#shop', reenter: true },
            NESTED: { target: '#shop.checkout.payment' }
          }
        },
        checkout: { initial: 'cart', states: { cart: {}, payment: {} } }
      }
    });
  });

  it('rejects unknown implicit `#` targets', () => {
    // Type-only: creating these machines throws.
    void (() => {
      // @ts-expect-error unknown implicit id
      createMachine({
        initial: 'idle',
        states: {
          idle: { on: { GO: { target: '#checkout.nope' } } },
          checkout: { initial: 'cart', states: { cart: {} } }
        }
      });
      // @ts-expect-error ids start with the machine id
      createMachine({
        id: 'shop',
        initial: 'idle',
        states: {
          idle: { on: { GO: { target: '#checkout.cart' } } },
          checkout: { initial: 'cart', states: { cart: {} } }
        }
      });
      // @ts-expect-error the root of a machine without an id has no `#id`
      createMachine({
        initial: 'idle',
        states: { idle: { on: { GO: { target: '#' } } } }
      });
    });
  });
});
