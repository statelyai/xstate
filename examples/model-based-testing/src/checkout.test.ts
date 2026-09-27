import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { createActor, type EventFrom, type SnapshotFrom } from 'xstate';
import { getShortestPaths, getSimplePaths } from 'xstate/graph';
import { propertyTest, testPaths, type TestSut } from '@xstate/test';
import { checkoutMachine } from './checkoutMachine.ts';
import { CheckoutUi } from './checkoutUi.ts';

type CheckoutSnapshot = SnapshotFrom<typeof checkoutMachine>;
type CheckoutEvent = EventFrom<typeof checkoutMachine>;

/**
 * The UI only offers the buttons of the current screen, so an event is sent
 * only when the machine accepts it in the current state.
 */
const enabled = ({
  snapshot,
  event
}: {
  snapshot: CheckoutSnapshot;
  event: CheckoutEvent;
}) => snapshot.can(event);

/**
 * `events` lists one case per equivalence class, including the payloads that
 * select a branch: a valid and an invalid ZIP, an accepted and a declined card.
 */
const events = {
  startCheckout: { generate: fc.constant({}), when: enabled },
  back: { generate: fc.constant({}), when: enabled },
  retry: { generate: fc.constant({}), when: enabled },
  submitAddress: [
    {
      case: 'valid zip',
      generate: fc.constant({ zip: '02134' }),
      when: enabled
    },
    {
      case: 'invalid zip',
      generate: fc.constant({ zip: 'nope' }),
      when: enabled
    }
  ],
  pay: [
    {
      case: 'accepted',
      generate: fc.constant({ card: '4111111111111111' }),
      when: enabled
    },
    {
      case: 'declined',
      generate: fc.constant({ card: '9000000000000000' }),
      when: enabled
    }
  ]
};

/**
 * The SUT session drives `CheckoutUi` with each event. After every step,
 * `read()` is compared with `projectModel(snapshot)`, and the `states`
 * assertions for the current state run.
 */
const checkoutSut: TestSut<CheckoutSnapshot, CheckoutEvent> = {
  create: () => {
    const ui = new CheckoutUi();
    return {
      send: (event) => {
        switch (event.type) {
          case 'startCheckout':
            return ui.startCheckout();
          case 'submitAddress':
            return ui.enterAddress(event.zip);
          case 'pay':
            return ui.pay(event.card);
          case 'back':
            return ui.back();
          case 'retry':
            return ui.retry();
        }
      },
      read: () => ({ screen: ui.screen, zip: ui.zip, error: ui.error }),
      states: {
        declined: () => expect(ui.receipt).toBeNull(),
        confirmed: () => expect(ui.receipt).not.toBeNull()
      }
    };
  },
  projectModel: (snapshot) => ({
    screen: snapshot.value,
    zip: snapshot.context.zip,
    error: snapshot.context.error
  })
};

describe('generated paths', () => {
  it('every simple path matches the model', async () => {
    const { results, coverage } = await testPaths(checkoutMachine, {
      pathGenerator: 'simple',
      events,
      samples: 1,
      sut: checkoutSut
    });

    expect(results.length).toBeGreaterThan(1);
    expect(results.every(({ passed }) => passed)).toBe(true);
    expect(coverage.transitions.uncovered).toEqual([]);
  });

  // Simple paths visit each state once, so they never take `retry` back to
  // `payment`. Random sequences do; `frontiers: 'auto'` starts extra runs
  // from states whose transitions are not covered yet.
  it('random event sequences match the model', async () => {
    const { coverage } = await propertyTest(checkoutMachine, {
      seed: 1,
      numRuns: 100,
      frontiers: 'auto',
      events,
      sut: checkoutSut
    });

    expect(coverage.transitions.uncovered).toEqual([]);
    expect(coverage.transitions.unknown).toEqual([]);
  });

  // One vitest case per path. Add a state to the machine and new cases
  // appear on their own.
  const paths = getSimplePaths(checkoutMachine, {
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

  it.each(
    paths.map((path) => [
      path.steps.map((step) => step.event.type).join(' → '),
      path
    ])
  )('%s', async (_description, path) => {
    await testPaths(checkoutMachine, { paths: [path], sut: checkoutSut });
  });

  it('reaches every state of the machine', () => {
    const visited = new Set(paths.map((path) => String(path.state.value)));

    expect([...visited].sort()).toEqual([
      'cart',
      'confirmed',
      'declined',
      'payment',
      'shipping'
    ]);
  });
});

describe('graph traversal', () => {
  // `xstate/graph` works on any actor logic, without a SUT. Use it for
  // reachability checks rather than test generation.
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

  // Paths are event sequences, so a path can be replayed through a real
  // actor.
  it('replays a path through a running actor', () => {
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
