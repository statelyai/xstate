# Property testing a shopping cart

The hello world for [`@xstate/test`](../../packages/xstate-test). A cart
machine, a hand-written implementation of the same cart, and three tests: one
that checks the model against itself, one that checks the implementation
against the model, and one that replays a recorded counterexample.

Run them with:

```bash
pnpm test
```

## Files

| File | What it is |
| --- | --- |
| `src/cart.machine.ts` | The model. Event payloads are declared as Zod schemas, so the generators are derived from them. |
| `src/cart-store.ts` | A plain `CartStore` class that mirrors the machine. Setting `CART_BUG=1` introduces one deliberate defect. |
| `src/cart.test.ts` | The three tests. |

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

`formatPropertyCoverage(coverage)` prints what the campaign reached:

```
Property coverage

states: 3/4 covered (75.0%), 0 uncovered, 0 unreachable, 1 unknown
stateNodes: 4/4 covered (100.0%), 0 uncovered, 0 unreachable, 0 unknown
configurations: 3/4 covered (75.0%), 0 uncovered, 0 unreachable, 1 unknown
statuses: 2/2 covered (100.0%), 0 uncovered, 0 unreachable, 0 unknown
eventTypes: 5/6 covered (83.3%), 0 uncovered, 0 unreachable, 1 unknown
transitions: 4/5 covered (80.0%), 0 uncovered, 0 unreachable, 1 unknown
guards: 0/0 covered (100.0%), 0 uncovered, 0 unreachable, 0 unknown
transitionPairs: 4/21 covered (19.0%), 0 uncovered, 0 unreachable, 17 unknown
requirements: 0/0 covered (100.0%), 0 uncovered, 0 unreachable, 0 unknown
frontiers: 0/0 covered (100.0%), 0 uncovered, 0 unreachable, 0 unknown

unknown eventTypes:
  - xstate.error.actor
unknown transitions:
  - cart.paying --xstate.error.actor--> #0
event cases:
  - ADD / default: 30 generated, 30 applicable, 30 executed, 0 ignored
  - CHECKOUT / default: 28 generated, 27 applicable, 27 executed, 1 ignored
  - REMOVE / default: 26 generated, 2 applicable, 2 executed, 24 ignored
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

`assertPropertyCoverage(coverage, { transitions: 1 })` then fails the test if a
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

## Test 3: replaying the counterexample

A `PropertyTestFailure` carries a `fixture`: a portable, plain-JSON record of
the sequence that failed. `replayPropertyTest(machine, fixture, options)`
re-runs exactly that sequence and expects the same failure, throwing
`PropertyReplayNotReproducedError` if the failure no longer happens.

Committing a fixture turns a generated counterexample into an ordinary
regression test that needs no generator and no seed.
