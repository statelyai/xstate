---
title: Model-based testing
description: Generate event sequences from a machine and check an implementation against it with @xstate/test.
---

A machine describes what a feature should do. Model-based testing uses that machine to generate the tests: `@xstate/test` produces event sequences from the machine, sends each sequence to the machine and to your implementation, and fails when the two disagree.

This page tests a hand-written shopping cart against a cart machine. For every option, see the [`@xstate/test` README](https://github.com/statelyai/xstate/tree/next/packages/xstate-test#readme).

## Install

```bash
pnpm add -D @xstate/test fast-check
```

`@xstate/test` generates values with [fast-check](https://fast-check.dev), which is a required peer dependency.

## Write the model

The model is an ordinary machine. It says what the cart must do: `ADD` adds one of a SKU, `REMOVE` takes a SKU out, and `CHECKOUT` finishes a cart that is not empty.

```ts
import { createMachine, types } from 'xstate';

export const cartMachine = createMachine({
  id: 'cart',
  schemas: {
    context: types<{ items: Record<string, number> }>(),
    events: {
      ADD: types<{ sku: string }>(),
      REMOVE: types<{ sku: string }>(),
      CHECKOUT: types<{}>()
    }
  },
  context: { items: {} },
  initial: 'shopping',
  states: {
    shopping: {
      on: {
        ADD: ({ context, event }) => ({
          context: {
            items: {
              ...context.items,
              [event.sku]: (context.items[event.sku] ?? 0) + 1
            }
          }
        }),
        REMOVE: ({ context, event }) => {
          const { [event.sku]: _removed, ...items } = context.items;
          return { context: { items } };
        },
        CHECKOUT: ({ context }) =>
          Object.keys(context.items).length
            ? { target: 'checkedOut' }
            : undefined
      }
    },
    checkedOut: { type: 'final' }
  }
});
```

The implementation under test is separate code:

```ts
export function createCart() {
  const items: Record<string, number> = {};
  return {
    add: (sku: string) => {
      items[sku] = (items[sku] ?? 0) + 1;
    },
    remove: (sku: string) => {
      delete items[sku];
    },
    items: () => ({ ...items })
  };
}
```

## Describe the events and the system under test

`events` says how to generate each event's payload. The key is the event type, and the value is a fast-check arbitrary for the rest of the event.

`sut` connects the implementation. `create()` makes a fresh cart for every run. `send` performs each event on it, and `read()` returns what to compare. `projectModel` selects the matching part of the machine's snapshot.

```ts
import * as fc from 'fast-check';
import type { EventFrom, SnapshotFrom } from 'xstate';
import type { TestSut } from '@xstate/test';

const sku = fc.constantFrom('apple', 'pear');
const events = {
  ADD: fc.record({ sku }),
  REMOVE: fc.record({ sku }),
  CHECKOUT: fc.constant({})
};

const cartSut: TestSut<
  SnapshotFrom<typeof cartMachine>,
  EventFrom<typeof cartMachine>
> = {
  create: () => {
    const cart = createCart();
    return {
      send: (event) => {
        if (event.type === 'ADD') {
          cart.add(event.sku);
        }
        if (event.type === 'REMOVE') {
          cart.remove(event.sku);
        }
      },
      read: () => cart.items()
    };
  },
  projectModel: (snapshot) => snapshot.context.items
};
```

## Generate random sequences

`propertyTest()` generates random sequences of events. For every step, it applies the event to the machine, sends it to the cart, and compares `read()` with `projectModel(snapshot)`.

```ts
import { formatTestCoverage, propertyTest } from '@xstate/test';

test('the cart matches the model', async () => {
  const { coverage } = await propertyTest(cartMachine, {
    seed: 1,
    numRuns: 100,
    events,
    sut: cartSut
  });
  console.log(formatTestCoverage(coverage));
});
```

The coverage report starts with one line per dimension:

```
states: 2/3 covered (66.7%), 0 uncovered, 0 unreachable, 1 unknown
stateNodes: 3/3 covered (100.0%), 0 uncovered, 0 unreachable, 0 unknown
configurations: 2/3 covered (66.7%), 0 uncovered, 0 unreachable, 1 unknown
statuses: 2/2 covered (100.0%), 0 uncovered, 0 unreachable, 0 unknown
eventTypes: 4/4 covered (100.0%), 0 uncovered, 0 unreachable, 0 unknown
transitions: 3/3 covered (100.0%), 0 uncovered, 0 unreachable, 0 unknown
```

All three transitions were taken. `seed` makes the run repeatable.

## Walk every path

`testPaths()` takes the same `events` and `sut`, and walks the machine's state graph instead of generating random sequences. Each arbitrary is sampled into three payloads before traversal.

```ts
import { testPaths } from '@xstate/test';

test('every simple path matches the model', async () => {
  const { results } = await testPaths(cartMachine, {
    pathGenerator: 'simple',
    events,
    sut: cartSut,
    stopWhen: (snapshot) =>
      Object.values(snapshot.context.items).some((qty) => qty >= 2)
  });
  expect(results).toHaveLength(15);
});
```

- `pathGenerator: 'simple'` walks every simple path. The default, `'shortest'`, keeps only the shortest path to each state, and removing the only item leads back to a state that is already reachable, so it never takes `REMOVE`.
- `stopWhen` stops expanding a state once a quantity reaches 2. Quantities grow without bound, so the graph needs a bound.

Use `testPaths()` when the reachable graph is finite and you want every path through it. Use `propertyTest()` when payloads, ordering, or timing matter.

## Read a failure

Change `remove` so that it sets the quantity of a SKU in the cart to zero instead of deleting it:

```ts
remove: (sku: string) => {
  if (sku in items) {
    items[sku] = 0;
  }
},
```

`propertyTest()` now throws a `ModelTestFailure`. fast-check shrinks the failing sequence to the shortest one it finds, and the message shows each step:

```
Property observation diverged
start {"status":"active","context":{"items":{}},"value":"shopping","children":{},"timers":{},"historyValue":{},"_nextTimerId":0,"tags":[]}
0. generated/generator {"sku":"pear","type":"ADD"} -> {"status":"active","context":{"items":{"pear":1}},"value":"shopping","children":{},"timers":{},"historyValue":{},"_nextTimerId":0,"tags":[]}
   transitions ["transition","cart.shopping","ADD",0]
   observations {"model":{"pear":1},"sut":{"model":{"pear":1},"observed":{"pear":1}}}
1. generated/generator {"sku":"pear","type":"REMOVE"} -> {"status":"active","context":{"items":{}},"value":"shopping","children":{},"timers":{},"historyValue":{},"_nextTimerId":0,"tags":[]}
   transitions ["transition","cart.shopping","REMOVE",0]
   observations {"model":{},"sut":{"model":{},"observed":{"pear":0}}}
```

Step 1 is the divergence. After `REMOVE pear`, the machine's projection is `{}` and the cart's is `{"pear":0}`.

## Replay a failure

`failure.fixture` is a JSON record of the failing sequence. Commit it, and replay it with `replayTest()` without generating anything:

```ts
import { replayTest, type TestFixture } from '@xstate/test';
import fixture from './cart-remove.fixture.json';

test('regression: removing an item', async () => {
  await replayTest(cartMachine, fixture as TestFixture, {
    sut: cartSut,
    expect: 'pass'
  });
});
```

With `expect: 'pass'`, the replay must complete without a failure. The default, `expect: 'failure'`, expects the recorded failure to happen again, and throws `ReplayNotReproducedError` when it does not.

## Gate CI on coverage

`assertTestCoverage()` throws when a dimension's covered ratio is below a threshold. The error message contains the full report.

```ts
import { assertTestCoverage } from '@xstate/test';

const { coverage } = await propertyTest(cartMachine, { events, sut: cartSut });
assertTestCoverage(coverage, { transitions: 1, stateNodes: 1 });
```

To stop generating as soon as coverage is reached, pass `until: { transitions: 1 }` and a `maxRuns` budget. `formatTestCoverageJUnit()`, `formatTestCoverageHTML()`, and `testCoverageToJSON()` write the same coverage as CI artifacts.

## Invoked actors and delays

By default the machine is stepped with [`transition()`](utilities.md), so invoked actors never start and `after` delays never fire. Set `mode: 'executed'` to run it as an actor on a simulated clock, and replace each service with a generated outcome. Here `orderMachine` invokes a `chargeCard` actor in its `charging` state and leaves that state `after` 5 seconds:

```ts
await propertyTest(orderMachine, {
  mode: 'executed',
  outcomes: {
    chargeCard: fc.oneof(
      fc.record({ ok: fc.constant(true as const), output: fc.record({ id: fc.string() }) }),
      fc.record({ ok: fc.constant(false as const), error: fc.constant('declined') })
    )
  },
  events: { SUBMIT: fc.constant({}) },
  commands: { advance: fc.integer({ min: 1_000, max: 10_000 }) }
});
```

fast-check chooses whether each charge succeeds or fails, when the result arrives, and how far the clock moves, and shrinks all three. No real service is called.

## What next?

- [Work through the full cart example](https://github.com/statelyai/xstate/tree/next/examples/property-testing-cart), including invoked actors and a replayed failure.
- [Test a web page with Playwright](https://github.com/statelyai/xstate/tree/next/packages/xstate-test#test-a-web-page-with-playwright).
- [Derive event generators from Zod or Effect schemas](https://github.com/statelyai/xstate/tree/next/packages/xstate-test#derive-event-generators-from-schemas).
- [Test transitions and actors directly](testing.md).
