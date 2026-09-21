# Property testing a shopping cart

The hello world for [`@xstate/test`](../../packages/xstate-test). A cart
machine, a hand-written implementation of the same cart, and four tests: one
that checks the model against itself, one that checks the implementation
against the model, one that walks the model's state graph instead of
generating sequences, and one that replays a recorded counterexample.

Run them with:

```bash
pnpm test
```

## Files

| File | What it is |
| --- | --- |
| `src/cart.machine.ts` | The model. Event payloads are declared as Zod schemas, so the generators are derived from them. |
| `src/cart-store.ts` | A plain `CartStore` class that mirrors the machine. Setting `CART_BUG=1` introduces one deliberate defect. |
| `src/cart.test.ts` | The four tests. |

## Test 1: the model on its own

`propertyTest()` generates sequences of `ADD`, `REMOVE` and `CHECKOUT`, runs
them, and checks that the cart never holds an item at quantity zero and that a
run eventually reaches `done`.

Three things are worth pointing at:

- **`ADD` and `CHECKOUT` have no entry in `events`.** They are derived from the
  machine's `schemas.events`. Only `REMOVE` is configured, because it has to
  name a SKU the cart actually holds: `generate: fc.nat()` produces a
  shrinkable index, and `resolve` turns it into an existing SKU, or `undefined`
  when the cart is empty so the event is skipped.
- **`mode: 'executed'` runs real actors.** The `pay` actor is replaced by a
  generated outcome, so both `onDone` and `onError` are reached without a
  network call.
- **`until: { transitions: 1 }` stops the campaign early**, as soon as every
  transition has been covered, rather than always running the full budget.

`formatTestCoverage(coverage)` prints what the campaign reached:

```
Test coverage

states: 3/4 covered (75.0%), 0 uncovered, 0 unreachable, 1 unknown
stateNodes: 4/4 covered (100.0%), 0 uncovered, 0 unreachable, 0 unknown
configurations: 3/4 covered (75.0%), 0 uncovered, 0 unreachable, 1 unknown
statuses: 2/2 covered (100.0%), 0 uncovered, 0 unreachable, 0 unknown
eventTypes: 6/6 covered (100.0%), 0 uncovered, 0 unreachable, 0 unknown
transitions: 5/5 covered (100.0%), 0 uncovered, 0 unreachable, 0 unknown
guards: 0/0 covered (100.0%), 0 uncovered, 0 unreachable, 0 unknown
transitionPairs: 9/24 covered (37.5%), 0 uncovered, 0 unreachable, 15 unknown
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
  truncated: false
  frontier ["frontier","initial"]: prefix 0, budget 25, configured 25, completed 25, attempted 25
  seed ["frontier","initial"]: engine fast-check, seed 1, path n/a
```

`assertTestCoverage(coverage, { transitions: 1 })` then fails the test if a
later change leaves a transition unexercised.

## Test 2: the implementation against the model

The second test adds a `sut`: `create` builds a `CartStore`, `send` dispatches
the generated event to it, and `read` returns its cart contents.
`projectModel` says which part of the model snapshot to compare against — here,
`context.items`.

The cart contents are the only thing the two implementations must agree on, so
`deriveEvents: false` keeps `CHECKOUT` out of the generated events; the
checkout path is covered by test 1.

A second `it` sets `CART_BUG=1` and asserts that the run fails. The defect is
small — `REMOVE` leaves the SKU in the cart at quantity zero instead of taking
it out — and the counterexample is shrunk down to the two events that expose
it:

```
Property observation diverged
start {"status":"active","context":{"items":{}},"value":"shopping", ...}
0. generated/generator {"sku":"apple","qty":1,"type":"ADD"} -> {"status":"active","context":{"items":{"apple":1}},"value":"shopping", ...}
   transitions ["transition","cart.shopping","ADD",0]
   observations {"model":{"apple":1},"sut":{"model":{"apple":1},"observed":{"apple":1}}}
1. generated/generator {"sku":"apple","type":"REMOVE"} -> {"status":"active","context":{"items":{}},"value":"shopping", ...}
   transitions ["transition","cart.shopping","REMOVE",0]
   observations {"model":{},"sut":{"model":{},"observed":{"apple":0}}}
```

The last line is the divergence: the model dropped `apple`, the store kept it
at zero.

## Test 3: the same machine, walked instead of generated

`testPaths()` takes the same `events`, the same oracles, and the same
`mode: 'executed'`. Only the generation keys change: `pathGenerator` picks the
traversal, `samples` decides how many concrete payloads each event case
contributes to the graph, and `stopWhen` bounds a cart that would otherwise
grow forever.

```ts
const { coverage, results } = await testPaths(cartMachine, {
  deriveEvents: false,
  pathGenerator: 'simple',
  samples: 1,
  seed: 3,
  events: { ADD, REMOVE },
  stopWhen: (snapshot) =>
    Object.values(snapshot.context.items).some((qty) => qty >= 2),
  mode: 'executed',
  outcomes: { pay: fc.constant({ ok: true, output: { receiptId: 'rcpt_1' } }) }
});
```

The graph already contains the invoked actor's branches: `paying` has an
`xstate.done.actor` and an `xstate.error.actor` transition, so the traversal
routes through both. In `mode: 'executed'` each of those steps is replayed as
an `outcome` command against a stubbed `pay` — the sampled outcome for the
branch that was taken, or a synthesized one for a branch `outcomes` does not
declare. An `after` transition works the same way, as a generated `advance`.
In the default `mode: 'pure'` the internal event is simply sent, carrying the
sampled `output` or `error` as its payload.

Two of the generation keys are there for traversal's sake. `pathGenerator:
'simple'` walks every simple path, not only the shortest one to each state, so
a `REMOVE` that leads somewhere already reachable is still exercised. And
`ADD` and `REMOVE` are declared as one case per SKU rather than as the
shrinkable index the property tests use, because a graph edge has to be the
same edge every time it is visited.

The coverage object is the one `propertyTest()` returns, so the same
formatters and assertions apply. Only `exploration` says which strategy ran:

```
transitions: 5/5 covered (100.0%), 0 uncovered, 0 unreachable, 0 unknown
event cases:
  - ADD / apple: 287 generated, 287 applicable, 287 executed, 0 ignored
  - ADD / pear: 287 generated, 287 applicable, 287 executed, 0 ignored
  - CHECKOUT / default: 208 generated, 208 applicable, 208 executed, 0 ignored
  - REMOVE / apple: 121 generated, 121 applicable, 121 executed, 0 ignored
  - REMOVE / pear: 121 generated, 121 applicable, 121 executed, 0 ignored

exploration:
  runs: configured 164, completed 164, attempted 164
  sequence length: max 12, max observed 12
  stopped because: budget
  seed ["frontier","initial"]: engine paths, seed n/a, path n/a
```

`expect(coverage.transitions.uncovered).toEqual([])` then holds: traversal
reaches every transition the machine declares.

A second `it` points the same traversal at the buggy store. Removing the only
item returns the cart to its starting state, so no shortest path covers
`REMOVE` on its own; a literal sequence does, and `fromEvents` walks `ADD`
then `REMOVE` against it. The failure is a `ModelTestFailure` with the same
trace, fixture, and coverage that `propertyTest()` produces —
`coverage.exploration.strategy` is the only difference.

## Test 4: replaying the counterexample

A `ModelTestFailure` carries a `fixture`: a portable, plain-JSON record of
the sequence that failed. `replayTest(machine, fixture, options)`
re-runs exactly that sequence and expects the same failure, throwing
`ReplayNotReproducedError` if the failure no longer happens.

Committing a fixture turns a generated counterexample into an ordinary
regression test that needs no generator and no seed.
