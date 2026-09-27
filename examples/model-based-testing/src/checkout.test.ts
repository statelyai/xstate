import { describe, expect, it } from 'vitest';
import { createActor } from 'xstate';
import { createTestModel, getShortestPaths } from 'xstate/graph';
import { checkoutMachine } from './checkoutMachine.ts';
import { CheckoutUi } from './checkoutUi.ts';

/**
 * `events` is the sample set path generation draws from: one entry per
 * equivalence class, including the payloads (`input`) that select a branch.
 */
const testModel = createTestModel(checkoutMachine, {
  events: [
    { type: 'startCheckout' },
    { type: 'submitAddress', zip: '02134' },
    { type: 'submitAddress', zip: 'nope' },
    { type: 'pay', card: '4111111111111111' },
    { type: 'pay', card: '9000000000000000' },
    { type: 'back' },
    { type: 'retry' }
  ]
});

const paths = testModel.getSimplePaths();

describe('generated paths', () => {
  it('generates more than one path', () => {
    expect(paths.length).toBeGreaterThan(1);
  });

  // One vitest case per generated path. Add a state to the machine and new
  // cases appear on their own.
  it.each(paths.map((path) => [path.description, path] as const))(
    '%s',
    async (_description, path) => {
      const ui = new CheckoutUi();

      await path.test({
        // Event executors drive the system under test with the generated
        // event, payload included.
        events: {
          startCheckout: () => ui.startCheckout(),
          submitAddress: ({ event }) => ui.enterAddress(event.zip),
          pay: ({ event }) => ui.pay(event.card),
          back: () => ui.back(),
          retry: () => ui.retry()
        },
        // State assertions are the postconditions, checked after every step.
        states: {
          cart: () => expect(ui.screen).toBe('cart'),
          shipping: (state) => {
            expect(ui.screen).toBe('shipping');
            expect(ui.error).toBe(state.context.error);
          },
          payment: (state) => {
            expect(ui.screen).toBe('payment');
            expect(ui.zip).toBe(state.context.zip);
          },
          declined: () => {
            expect(ui.screen).toBe('declined');
            expect(ui.receipt).toBeNull();
          },
          confirmed: () => {
            expect(ui.screen).toBe('confirmed');
            expect(ui.receipt).not.toBeNull();
          }
        }
      });
    }
  );
});

describe('coverage', () => {
  it('reaches every state of the machine', () => {
    const visited = new Set(
      paths.flatMap((path) =>
        path.steps.map((step) => String(step.state.value))
      )
    );

    expect([...visited].sort()).toEqual([
      'cart',
      'confirmed',
      'declined',
      'payment',
      'shipping'
    ]);
  });
});

describe('standalone generators', () => {
  // The generators also work without a `TestModel`, straight on any actor
  // logic — useful for reachability checks rather than test generation.
  it('finds the shortest way to a confirmed order', () => {
    const [shortest] = getShortestPaths(checkoutMachine, {
      events: [
        { type: 'startCheckout' },
        { type: 'submitAddress', zip: '02134' },
        { type: 'pay', card: '4111111111111111' }
      ],
      toState: (snapshot) => snapshot.matches('confirmed')
    });

    expect(shortest.steps.map((step) => step.event.type)).toEqual([
      '@xstate.init',
      'startCheckout',
      'submitAddress',
      'pay'
    ]);
    expect(shortest.state.context.paid).toBe(true);
  });

  // Paths are just event sequences, so a generated path can be replayed
  // through a real actor.
  it('replays a generated path through a running actor', () => {
    const [path] = getShortestPaths(checkoutMachine, {
      events: [
        { type: 'startCheckout' },
        { type: 'submitAddress', zip: '02134' },
        { type: 'pay', card: '9000000000000000' }
      ],
      toState: (snapshot) => snapshot.matches('declined')
    });

    const actor = createActor(checkoutMachine).start();
    for (const step of path.steps.slice(1)) {
      actor.send(step.event);
    }

    expect(actor.getSnapshot().value).toBe('declined');
    expect(actor.getSnapshot().context.error).toBe('Card declined');
    actor.stop();
  });
});
