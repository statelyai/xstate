# Property testing a shopping cart

The reference example for [`@xstate/test`](../../packages/xstate-test). A cart
machine is the model, a hand-written `CartStore` is the implementation, and six
tests check one against the other with `propertyTest()` and `testPaths()`. One
deliberate bug shows what a failure looks like and how to replay it.

Run the tests from this directory:

```bash
pnpm test
```

## Files

| File | Contents |
| --- | --- |
| `src/cart.machine.ts` | The model. Event payloads are declared as Zod schemas, so generators are derived from them. Checkout invokes a `pay` actor. |
| `src/cart-store.ts` | `CartStore`, the implementation. `CART_BUG=1` makes `REMOVE` leave the SKU in the cart at quantity zero. |
| `src/cart.test.ts` | The six tests. |

## The model

The cart has three states: `shopping`, `paying`, and `done`. In `shopping`,
`ADD` adds a quantity of a SKU, `REMOVE` takes a SKU out, and `CHECKOUT` moves
to `paying` when the cart is not empty. `paying` invokes `pay`. `onDone` moves
to `done`, and `onError` returns to `shopping` with the error recorded in
`lastError`.

The event schemas are Zod schemas:

```ts
events: {
  ADD: z.object({
    sku: z.string().min(1),
    qty: z.number().int().min(1).max(5)
  }),
  REMOVE: z.object({ sku: z.string() }),
  CHECKOUT: z.object({})
}
```

`propertyTest()` derives a generator for every event type that `events` does
not configure, and honors the constraints: the `ADD` generator only produces
non-empty SKUs and integer quantities from 1 to 5.

## The six tests

### 1. `checks out, and never holds an item at quantity zero`

`propertyTest()` checks the model on its own. There is no `sut`.

- `events` configures only `REMOVE`. `ADD` and `CHECKOUT` are derived from the
  schemas. `REMOVE` must name a SKU that is in the cart, so it is a
  descriptor: `generate: fc.nat()` produces a shrinkable index, and `resolve`
  maps it to one of the SKUs in the current snapshot, or returns `undefined`
  when the cart is empty, which skips the event.
- `mode: 'executed'` runs the machine as an actor, so the `pay` invocation
  starts. `outcomes.pay` replaces `pay` with a stub whose result is generated:
  a receipt or a declined card. Both `onDone` and `onError` are reached
  without a network call.
- `invariant` checks that every quantity in the cart is above zero.
- `temporal` declares that a run reaches `done` within 20 steps. A run that
  ends sooner without reaching `done` is inconclusive, not failed.
- `until: { transitions: 1 }` stops the campaign once every transition has
  been taken.

`formatTestCoverage(coverage)` prints:

```
Test coverage

states: 3/3 covered (100.0%), 0 uncovered, 0 unreachable, 0 unknown
stateNodes: 4/4 covered (100.0%), 0 uncovered, 0 unreachable, 0 unknown
configurations: 3/3 covered (100.0%), 0 uncovered, 0 unreachable, 0 unknown
statuses: 2/2 covered (100.0%), 0 uncovered, 0 unreachable, 0 unknown
eventTypes: 6/6 covered (100.0%), 0 uncovered, 0 unreachable, 0 unknown
transitions: 5/5 covered (100.0%), 0 uncovered, 0 unreachable, 0 unknown
guards: 0/0 covered (100.0%), 0 uncovered, 0 unreachable, 0 unknown
transitionPairs: 9/9 covered (100.0%), 0 uncovered, 0 unreachable, 0 unknown
requirements: 0/0 covered (100.0%), 0 uncovered, 0 unreachable, 0 unknown
frontiers: 0/0 covered (100.0%), 0 uncovered, 0 unreachable, 0 unknown

event cases:
  - ADD / default: 37 generated, 36 applicable, 36 executed, 1 ignored
  - CHECKOUT / default: 22 generated, 21 applicable, 21 executed, 1 ignored
  - REMOVE / default: 30 generated, 15 applicable, 15 executed, 15 ignored
temporal: 1 satisfied, 0 failed, 0 inconclusive
  satisfied:
  - checks-out

exploration:
  runs: configured 100, completed 25, attempted 25
  sequence length: max 10, max observed 8
  stopped because: until
  frontier ["frontier","initial"]: prefix 0, budget 25, configured 25, completed 25, attempted 25
  seed ["frontier","initial"]: engine fast-check, seed 1, path n/a
```

The campaign stopped after 25 of 100 runs because every transition was
covered. An event case is `ignored` when it is not applicable: `REMOVE` on an
empty cart, where `resolve` returns `undefined`, or any event outside
`shopping`. Most transitions in this machine compute their target with a
function, so `transitionPairs` declares no pairs up front; the 9 listed are
the pairs the runs took.
`assertTestCoverage(coverage, { transitions: 1 })` then fails the test if a
later change leaves a transition untaken.

### 2. `matches the model`

The test adds a `sut`. `create()` builds a new `CartStore` for each run, `send`
dispatches each event to it, and `read()` returns its items. `projectModel`
selects the part of the model to compare, `context.items`. After every step,
the two must be deeply equal.

The cart contents are the only thing the store and the machine are compared
on, so the test sets `deriveEvents: false` and configures only `ADD` and
`REMOVE`. Test 1 covers checkout.

### 3. `reports a counterexample when the store is buggy`

The same options, with `CART_BUG=1` set. `propertyTest()` throws a
`ModelTestFailure`, and fast-check shrinks the sequence to the two events
that expose the bug. The next section shows the failure.

### 4. `walks every simple path`

`testPaths()` runs the same machine with the same kind of options. The
generation options are different:

```ts
const { coverage, results } = await testPaths(cartMachine, {
  deriveEvents: false,
  pathGenerator: 'simple',
  samples: 1,
  seed: 3,
  events: {
    ADD: [
      { case: 'apple', generate: fc.constant({ sku: 'apple', qty: 1 }) },
      { case: 'pear', generate: fc.constant({ sku: 'pear', qty: 1 }) }
    ],
    REMOVE: [
      { case: 'apple', generate: fc.constant({ sku: 'apple' }) },
      { case: 'pear', generate: fc.constant({ sku: 'pear' }) }
    ]
  },
  stopWhen: (snapshot) =>
    Object.values(snapshot.context.items).some((qty) => qty >= 2),
  mode: 'executed',
  outcomes: {
    pay: fc.constant({ ok: true, output: { receiptId: 'rcpt_1' } })
  },
  invariant: ({ snapshot }) => {
    /* the invariant from test 1 */
  }
});
```

- Each event case names a fixed SKU. A graph edge must lead to the same state
  every time it is taken, so the shrinkable index from test 1 does not fit
  here.
- `samples: 1` draws one payload per case, which keeps the graph small.
- `stopWhen` stops expanding a state once a quantity reaches 2. Without it the
  cart, and the graph, grow without bound.
- `pathGenerator: 'simple'` walks every simple path. The default shortest
  paths would never take `REMOVE`, because removing the only item returns to a
  state that is already reachable.
- The state graph contains the `xstate.done.actor` and `xstate.error.actor`
  transitions out of `paying`. In executed mode, each of those steps becomes
  an `outcome` command against a stubbed `pay`. `outcomes` declares only a
  success, so the error branch resolves with a synthesized failure.

The coverage object has the same shape as in test 1. Only `exploration` shows
the strategy (event case and exploration lines):

```
transitions: 5/5 covered (100.0%), 0 uncovered, 0 unreachable, 0 unknown
...
event cases:
  - ADD / apple: 287 generated, 287 applicable, 287 executed, 0 ignored
  - ADD / pear: 287 generated, 287 applicable, 287 executed, 0 ignored
  - CHECKOUT / default: 208 generated, 208 applicable, 208 executed, 0 ignored
  - REMOVE / apple: 121 generated, 121 applicable, 121 executed, 0 ignored
  - REMOVE / pear: 121 generated, 121 applicable, 121 executed, 0 ignored
temporal: 0 satisfied, 0 failed, 0 inconclusive

exploration:
  runs: configured 164, completed 164, attempted 164
  sequence length: max 12, max observed 12
  stopped because: paths
  frontier ["frontier","initial"]: prefix 0, budget n/a, configured 164, completed 164, attempted 164
  seed ["frontier","initial"]: engine paths, seed n/a, path n/a
```

164 paths ran, one run each. `CHECKOUT` was not configured, so traversal sent
it as a bare `{ type: 'CHECKOUT' }`. The test asserts that
`coverage.transitions.uncovered` is empty and that
`coverage.exploration.strategy` is `'paths'`.

### 5. `reports the same failure class when the store is buggy`

`testPaths()` against the buggy store, with `fromEvents` instead of a
generator: the single path `ADD apple`, then `REMOVE apple`. It throws the
same `ModelTestFailure`, with a trace, a fixture, and coverage. Only
`failure.coverage.exploration.strategy` differs: `'paths'`.

### 6. `replays a recorded counterexample`

The test produces the failure from test 3, takes `failure.fixture`, and
replays it with `replayTest()`. The replay stops at the recorded failing step
and throws the same `ModelTestFailure`. No generator runs.

## What a failure looks like

With `CART_BUG=1`, test 3 fails with this `ModelTestFailure` message:

```
Property observation diverged
Reproduce: seed 2, path "1:2:1:1:1", replayPath "CBDH:K"
Fixture: failure.fixture (replayTest)
Shrunk 4 time(s)

start {"value":"shopping","context":{"items":{},"lastError":null}}
1. generator ADD {"sku":"apple","qty":1} -> {"value":"shopping","context":{"items":{"apple":1},"lastError":null}}
2. generator REMOVE {"sku":"apple"} -> {"value":"shopping","context":{"items":{},"lastError":null}}
   sut diverged
     model:    {}
     observed: {"apple":0}
```

The first line is `failure.summary`. `Reproduce` gives the fast-check
`seed`, `path`, and `replayPath` that rerun this counterexample, and `Shrunk`
counts the shrinking steps fast-check took to reach it. The numbered lines
are `formatTestTrace(failure.trace)`: each step's origin (`generator`), its
event, and the model's `{ value, context }` after it. Step 2 sent
`REMOVE apple`. The model's projection is `{}`, and the store's is
`{"apple":0}`: the store kept the SKU at quantity zero.

`failure.fixture` records the same sequence as JSON:

```json
{
  "formatVersion": 2,
  "machine": { "id": "cart" },
  "start": { "type": "input" },
  "timeline": [
    {
      "kind": "event",
      "command": {
        "type": "event",
        "event": { "sku": "apple", "qty": 1, "type": "ADD" },
        "phase": "generated",
        "origin": "generator",
        "caseId": "[\"event-case\",\"ADD\",\"default\"]"
      }
    },
    {
      "kind": "event",
      "command": {
        "type": "event",
        "event": { "sku": "apple", "type": "REMOVE" },
        "phase": "generated",
        "origin": "generator",
        "caseId": "[\"event-case\",\"REMOVE\",\"default\"]"
      }
    }
  ],
  "failedAt": 3
}
```

Save it as `src/cart-remove.fixture.json` and replay it:

```ts
import { replayTest, type TestFixture } from '@xstate/test';
import fixture from './cart-remove.fixture.json';

await replayTest(cartMachine, fixture as TestFixture, {
  sut: {
    create: () => {
      const store = new CartStore();
      return {
        send: (event: CartEvent) => store.dispatch(event),
        read: () => store.getState().items
      };
    },
    projectModel: (snapshot) => snapshot.context.items
  }
});
```

With the bug present, `replayTest()` throws the same `ModelTestFailure`. With
the bug fixed, it throws `ReplayNotReproducedError`:
`Property replay did not reproduce the recorded failure at step 3`. Pass
`expect: 'pass'` to keep the fixture as a regression test that must pass.

`failure.replay` holds the fast-check replay data instead:
`{ "engine": "fast-check", "seed": 2, "path": "0:2:1:1:1:1", "replayPath": "EBK:F" }`.
Passing `seed`, `path`, and `replayPath` to `propertyTest()` with the options
from test 2 reruns the shrunk case directly. That depends on the generators
and the fast-check version staying the same; the fixture does not.

See [Replay a failure](../../packages/xstate-test#replay-a-failure) in the
package README for the options `replayTest()` accepts.
