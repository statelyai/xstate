# `@xstate/test`

Model-based and property-based testing for XState, built on
[fast-check](https://fast-check.dev).

Describe the behavior you expect as a state machine. `@xstate/test` generates
event sequences from that machine, sends each sequence to the machine and to
your implementation, and fails when the two disagree or when a property you
declared stops holding.

Two functions generate the sequences:

- `testPaths()` walks the machine's state graph and runs every path it finds.
- `propertyTest()` generates random sequences and shrinks a failing one to a
  minimal counterexample.

Both take the same options, return the same coverage object, and throw the
same `ModelTestFailure`.
[`examples/property-testing-cart`](../../examples/property-testing-cart) is the
complete worked example.

- [Installation](#installation)
- [Quick start](#quick-start)
- [Concepts](#concepts)
- [How-to guides](#how-to-guides)
- [Reference](#reference)
- [Migrating from `@xstate/test` 0.x and 1.0 beta](#migrating-from-xstatetest-0x-and-10-beta)
- [Comparison](#comparison)

## Installation

```bash
pnpm add -D @xstate/test fast-check xstate
```

`xstate` and `fast-check` are required peer dependencies. The other peer
dependencies are optional:

| Package | Needed for |
| --- | --- |
| `zod` (v3.25+ or v4) | Deriving event generators from Zod event schemas. |
| `effect` (v4) | Deriving event generators from Effect Schemas, through `@xstate/test/effect-schema`. |
| `@playwright/test` or `playwright` (1.40+) | `@xstate/test/playwright`. |

## Quick start

This section tests a hand-written cart against a cart machine, first with
`propertyTest()` and then with `testPaths()`.

The machine is the model. It says what the cart must do:

```ts
// cart.machine.ts
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

The implementation is the code under test:

```ts
// cart.ts
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

### Describe the events and the SUT

`events` says how to generate each event's payload. `sut` says how to send an
event to the cart and how to compare the cart with the machine:

```ts
// cart.test.ts
import * as fc from 'fast-check';
import type { EventFrom, SnapshotFrom } from 'xstate';
import { formatTestCoverage, propertyTest, type TestSut } from '@xstate/test';
import { createCart } from './cart';
import { cartMachine } from './cart.machine';

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

### Generate random sequences with `propertyTest()`

```ts
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

`propertyTest()` generates 100 sequences of `ADD`, `REMOVE`, and `CHECKOUT`.
For every step, it applies the event to the machine, sends it to the cart
through `send`, and compares `read()` with `projectModel(snapshot)`. The
printed coverage starts with:

```
Test coverage

states: 2/2 covered (100.0%), 0 uncovered, 0 unreachable, 0 unknown
stateNodes: 3/3 covered (100.0%), 0 uncovered, 0 unreachable, 0 unknown
configurations: 2/2 covered (100.0%), 0 uncovered, 0 unreachable, 0 unknown
statuses: 2/2 covered (100.0%), 0 uncovered, 0 unreachable, 0 unknown
eventTypes: 4/4 covered (100.0%), 0 uncovered, 0 unreachable, 0 unknown
transitions: 3/3 covered (100.0%), 0 uncovered, 0 unreachable, 0 unknown
...
event cases:
  - ADD / default: 154 generated, 115 applicable, 115 executed, 39 ignored
  - CHECKOUT / default: 170 generated, 126 applicable, 126 executed, 44 ignored
  - REMOVE / default: 147 generated, 112 applicable, 112 executed, 35 ignored
```

An event case is `ignored` when the machine does not accept it in the current
state, such as `CHECKOUT` on an empty cart.

### Walk the state graph with `testPaths()`

`testPaths()` takes the same `events` and the same `sut`:

```ts
import { testPaths } from '@xstate/test';

test('every simple path matches the model', async () => {
  const { coverage, results } = await testPaths(cartMachine, {
    pathGenerator: 'simple',
    events,
    sut: cartSut,
    // Quantities grow without bound; stop expanding at 2.
    stopWhen: (snapshot) =>
      Object.values(snapshot.context.items).some((qty) => qty >= 2)
  });
  console.log(`${results.length} paths`);
  console.log(formatTestCoverage(coverage));
});
```

Each `fc` arbitrary is sampled into three concrete payloads before traversal
(`samples` defaults to `3`), and each path runs once. The output starts with:

```
15 paths
Test coverage

states: 2/2 covered (100.0%), 0 uncovered, 0 unreachable, 0 unknown
stateNodes: 3/3 covered (100.0%), 0 uncovered, 0 unreachable, 0 unknown
configurations: 2/2 covered (100.0%), 0 uncovered, 0 unreachable, 0 unknown
statuses: 2/2 covered (100.0%), 0 uncovered, 0 unreachable, 0 unknown
eventTypes: 4/4 covered (100.0%), 0 uncovered, 0 unreachable, 0 unknown
transitions: 3/3 covered (100.0%), 0 uncovered, 0 unreachable, 0 unknown
```

`pathGenerator: 'simple'` is needed here. `REMOVE` of the only item returns
the cart to a state that is already reachable, so the default `'shortest'`
generator never takes it.

When the cart and the machine disagree, both functions throw a
`ModelTestFailure` that shows the failing sequence step by step. See
[What a failure looks like](../../examples/property-testing-cart#what-a-failure-looks-like)
in the cart example.

## Concepts

### Model and system under test

The **model** is an XState machine that describes the expected behavior. The
**system under test** (SUT) is the code being tested: a class, a store, a
service, or a web page. A run starts both, sends them the same events, and
checks them after every **stable step**, which is the point at which an event
or command has been fully processed.

The model runs in memory. By default it is stepped through XState's pure
`transition()` function, so no actions run and no actors start.

### Events

`events` says which events a run may send, and how their payloads are
produced. Each key is an event type, and each value is one of:

- a generator, such as `fc.record({ sku })`. The generator produces the payload
  without `type`; the key supplies `type`. The generator becomes one **event
  case** named `default`.
- a descriptor object, `{ case, generate, when, resolve, weight }`.
- an array of generators and descriptors, one event case each.

```ts
events: {
  ADD: [
    { case: 'apple', generate: fc.constant({ sku: 'apple' }) },
    {
      case: 'known-sku',
      generate: fc.constantFrom('apple', 'pear'),
      resolve: ({ generated }) => ({ sku: generated as string }),
      when: ({ snapshot }) => Object.keys(snapshot.context.items).length < 3
    }
  ]
}
```

| Descriptor field | Purpose |
| --- | --- |
| `generate` | Produces the payload, or with `resolve`, a value `resolve` turns into a payload. |
| `case` | Names the event case in coverage and in `sut.send()`. Defaults to `'default'`. |
| `when` | Returns `false` to make the case inapplicable for the current snapshot and event. |
| `resolve` | Turns the generated value into a payload using the current model snapshot. Returning `undefined` makes the case inapplicable. |
| `weight` | Relative generation frequency under `propertyTest()`. Defaults to `1`. |

`resolve` is for payloads that must refer to the current state, such as an item
that is already in the cart. fast-check shrinks the generated value, and the
resolved event is what gets recorded, so replay fixtures do not depend on the
resolver.

`pick(select, toPayload?)` builds such a descriptor. `select` lists the
candidates in the current snapshot, and `toPayload` turns the picked one into
the payload; without it, the candidate is the payload. The case is
inapplicable when `select` returns an empty array. The index into the
candidates is generated with `fc.nat()`, so a failing run shrinks towards the
first candidate. The snapshot type is inferred from the machine:

```ts
import { pick } from '@xstate/test';

events: {
  REMOVE: pick(
    (snapshot) => Object.keys(snapshot.context.items),
    (sku) => ({ sku })
  )
}
```

`pick()` from `xstate/graph` does the same with a plain `(rng) => index`
generator, for `testPaths()` and custom adapters in `xstate/graph`.

`propertyTest()` sends only the event types that `events` configures, plus the
types it derives from schemas (see
[Derive event generators from schemas](#derive-event-generators-from-schemas)).
`testPaths()` also offers every event type the machine handles that `events`
does not configure, as a bare `{ type }` event.

Generated payloads must be plain objects. A generator that produces a
primitive, an array, or `null` fails the run with an error naming the event
case.

### The `sut` option

`sut` describes the system under test. Both entry points accept the same
shape:

```ts
sut: {
  create: () => {
    const cart = createCart();
    return {
      send: (event) => { /* perform the event */ },
      read: () => cart.items(),
      dispose: () => { /* tear down */ }
    };
  },
  projectModel: (snapshot) => snapshot.context.items
}
```

`create()` runs once per run: once per generated sequence, per shrink attempt,
or per path. The session it returns is disposed at the end of the run, whether
the run passed or failed. After every stable step, the runner compares
`projectSut(read())` with `projectModel(snapshot)` using `equivalent`, which
defaults to structural, key-order-insensitive deep equality
(`defaultEquivalent`). Omit `read` and `projectModel` to check the SUT only
through `states` assertions.

The [session members](#sut) are listed in the reference.

### Oracles

An **oracle** decides whether a step is correct. Every oracle runs on every
stable step:

| Oracle | Option | Fails when |
| --- | --- | --- |
| Invariant | `invariant` | The function throws. |
| Temporal property | `temporal` | An `always`, `never`, `eventually`, `until`, or `respond` property is violated. |
| SUT comparison | `sut.projectModel` with `session.read` | The SUT's observation differs from the model's projection. |
| State assertions | `states`, `session.states`, `meta.test` | An assertion for a matching state throws. |
| SUT check | `session.check` | The function throws, such as the page oracles of `@xstate/test/playwright`. |
| Reference implementation | `reference` | A second implementation of the same logic disagrees with the model. |

Two oracles are checked once, when the campaign ends, and fail it with a
`TestCampaignError`:

| Oracle | Option | Fails when |
| --- | --- | --- |
| `sometimes` property | `temporal` | The predicate held on no step of any run. |
| Reachability | `reachable` | No run entered a listed state. |

`states` is keyed by state value (`'shopping'`, `'form.email'`), by state node
id (`'#cart.shopping'`), or `'*'`, which runs when no other key matches. A
`states` map on the session replaces the top-level one. Functions in a state
node's `meta.test` run too, and receive the session and the snapshot.

### Modes

`mode` decides how the model runs:

- `'pure'` (the default) steps the machine through `transition()`. No action
  runs and no invoked actor starts. Invoke results and `after` delays are
  reached only by sending the internal events for them.
- `'executed'` runs the machine as a real actor on a `SimulatedClock`. Invoked
  and spawned actors start, `onDone` and `onError` fire, and `after`
  transitions fire when the clock is advanced.

See [Steer invoked services](#steer-invoked-services) and
[Test delayed transitions](#test-delayed-transitions).

### `testPaths()` or `propertyTest()`

| | `testPaths()` | `propertyTest()` |
| --- | --- | --- |
| Sequences | Paths through the reachable state graph | Random sequences |
| Payloads | Sampled once before traversal, `samples` per case | Generated per run |
| On failure | Throws on the first failing path | Throws a shrunk counterexample |
| `onDone`, `onError`, `after` | Traversed as internal events | Reached with `mode: 'executed'` |
| Budget | Every path | `numRuns`, or `until` with `maxRuns` |
| Offline suites | No | `generateTestSuite()` |

Use `testPaths()` when the reachable graph is finite and you want every path
through it. Use `propertyTest()` when payloads, ordering, or timing matter, or
when the graph is too large to enumerate.

### Coverage

Both entry points resolve with `{ coverage }`. Coverage counts what the runs
exercised across these dimensions: `states`, `stateNodes`, `configurations`,
`statuses`, `eventTypes`, `transitions`, `guards`, `transitionPairs`,
`requirements`, and `frontiers`. Each dimension sorts its ids into `covered`,
`uncovered`, `unreachable`, and `unknown`. Transition hits come from the
microsteps XState took, not from the states that were visited.

Coverage is relative to the events you supplied and the bounds you set. Full
transition coverage means every declared transition was taken at least once,
not that every behavior was tested. See [Coverage](#coverage-1) in the
reference.

## How-to guides

### Derive event generators from schemas

When the machine declares its event payloads as Zod schemas, `propertyTest()`
and `testPaths()` derive the generators from them:

```ts
import { setup } from 'xstate';
import * as z from 'zod';

const counterMachine = setup({
  schemas: {
    events: {
      INC: z.object({ by: z.number().int().min(1).max(5) }),
      RESET: z.object({})
    }
  }
}).createMachine({
  context: { count: 0 },
  on: {
    INC: ({ context, event }) => ({
      context: { count: context.count + event.by }
    }),
    RESET: () => ({ context: { count: 0 } })
  }
});

await propertyTest(counterMachine, {
  invariant: ({ snapshot }) => {
    expect(snapshot.context.count).toBeGreaterThanOrEqual(0);
  }
});
```

Declared constraints are honored: this `INC` generator only produces integers
from 1 to 5. Every event type with a runtime schema that `events` does not
configure is derived. Entries in `events` override derived ones. Pass
`deriveEvents: false` to derive nothing.

To inspect or edit the derived map, call `eventsFromSchemas()` yourself, and
merge overrides with `mergeEventGenerators()`:

```ts
import { eventsFromSchemas, mergeEventGenerators } from '@xstate/test';

await propertyTest(counterMachine, {
  deriveEvents: false,
  events: mergeEventGenerators(eventsFromSchemas(counterMachine), {
    INC: fc.record({ by: fc.constant(1) })
  })
});
```

For Effect Schemas, import `eventsFromSchemas` from
`@xstate/test/effect-schema`. `fromEffectSchema(schema)` and
`fromEffectSchemas(map)` from the same entrypoint convert schemas directly:

```ts
import * as Schema from 'effect/Schema';
import { fromEffectSchemas } from '@xstate/test/effect-schema';

await propertyTest(counterMachine, {
  deriveEvents: false,
  events: fromEffectSchemas({
    INC: Schema.Struct({
      by: Schema.Int.pipe(Schema.check(Schema.isGreaterThan(0)))
    }),
    RESET: Schema.Struct({})
  })
});
```

Schemas that expose no structure cannot be derived from. That includes other
Standard Schema libraries and type-only `types<...>()` declarations. Implicit
derivation skips `types<...>()` declarations. For other schemas, configure the
event in `events`, or pass a `fallback` converter to `eventsFromSchemas()`.
The supported Zod kinds are listed under
[`eventsFromSchemas()`](#eventsfromschemas) in the reference.

### Steer invoked services

Run the machine with `mode: 'executed'` to reach `onDone` and `onError`
transitions. Replace real services with `actors` or `outcomes`, so a run
never reaches the network.

`actors` substitutes fixed logic through `machine.provide({ actors })`:

```ts
await propertyTest(orderMachine, {
  mode: 'executed',
  actors: {
    chargeCard: createAsyncLogic({ run: async () => ({ id: 'ch_1' }) })
  },
  events: { SUBMIT: fc.constant({}) }
});
```

`outcomes` replaces a named invoke source with a stub. The stub stays pending
until the run generates an `outcome` command for it, so fast-check chooses the
result and when it arrives, and shrinks both:

```ts
await propertyTest(orderMachine, {
  mode: 'executed',
  outcomes: {
    chargeCard: fc.oneof(
      fc.record({ ok: fc.constant(true as const), output: fc.record({ id: fc.string() }) }),
      fc.record({ ok: fc.constant(false as const), error: fc.constant('declined') })
    )
  },
  events: { SUBMIT: fc.constant({}) }
});
```

An outcome is `{ ok: true, output }` or `{ ok: false, error }`. A stub that
never receives an outcome stays pending, and the run ends with the machine in
the invoking state. `propertyTest()` rejects `actors` and `outcomes` in pure
mode.

`testPaths()` already traverses `onDone` and `onError`: the state graph
contains `xstate.done.actor` and `xstate.error.actor` transitions. It samples
`outcomes` the same way it samples `events`:

- In pure mode, it sends the internal event with the sampled `output` or
  `error` as its payload.
- In executed mode, it stubs every invoke source a path resolves and resolves
  the stub with the sampled outcome for the branch the path took. A branch
  with no matching outcome gets a synthesized one: `{ ok: true, output: undefined }`
  or `{ ok: false, error: new Error('generated failure') }`.

A source named in `outcomes` needs no implementation in either mode.

```ts
const { coverage } = await testPaths(orderMachine, {
  mode: 'executed',
  outcomes: {
    chargeCard: fc.constant({ ok: true as const, output: { id: 'ch_1' } })
  }
});
```

This run reaches `declined` too: no `ok: false` outcome is declared, so the
error branch resolves with a synthesized failure.

Executed mode is deterministic for everything that goes through the actor
system and the simulated clock. Real network calls, timers created outside the
actor clock, `Date.now()`, and `Math.random()` are not intercepted. A step
settles once the actor system has produced no new events for two consecutive
macrotask turns. An invoked actor whose promise is still pending at that point
is listed in the step's `pendingActors`, and
`coverage.exploration.pendingActorSteps` counts such steps: its result may
land in a later step.

### Test delayed transitions

In executed mode, time moves only through `advance` commands. With
`propertyTest()`, configure a generator for them:

```ts
await propertyTest(orderMachine, {
  mode: 'executed',
  outcomes: { chargeCard: fc.constant({ ok: true as const, output: { id: 'ch_1' } }) },
  events: { SUBMIT: fc.constant({}) },
  commands: { advance: fc.integer({ min: 1_000, max: 10_000 }) }
});
```

`testPaths()` needs no configuration. Traversal offers only the `after`
transition that is due first, counting the time already spent in enclosing
states. In executed mode, each `xstate.after` step advances the clock to that
timer's due time, read from the actor's scheduler, so a delay computed at
runtime works too.

In pure mode, the model has no clock. A SUT that owns its clock can implement
`session.advance(ms)` and return the events that fired; the runner applies
them to the model before the next comparison.

### Test a web page with Playwright

`createPlaywrightSut(page, config)` from `@xstate/test/playwright` returns a
`sut` that drives a Playwright page:

```ts
import { test } from '@playwright/test';
import * as fc from 'fast-check';
import { propertyTest } from '@xstate/test';
import { createPlaywrightSut } from '@xstate/test/playwright';
import { formMachine } from './form.machine';

test('the form matches its model', async ({ page }) => {
  await propertyTest(formMachine, {
    numRuns: 25,
    maxCommands: 8,
    events: {
      FILL: fc.record({ value: fc.constantFrom('', 'Ada', 'ada@example.com') }),
      NEXT: fc.constant({}),
      BACK: fc.constant({})
    },
    sut: createPlaywrightSut(page, {
      reset: async (page) => {
        await page.goto('/');
      },
      events: {
        FILL: (page, event) => page.fill('#field', event.value),
        NEXT: (page) => page.click('#next'),
        BACK: (page) => page.click('#back')
      },
      read: async (page) => ({
        step: await page.locator('#step').textContent(),
        error: await page.locator('#error').textContent()
      }),
      projectModel: (snapshot) => ({
        step: String(snapshot.value),
        error: snapshot.context.error
      })
    })
  });
});
```

Put navigation in `reset`. It runs at the start of every run, and without it a
run starts from the page the previous run left behind.

These defaults apply to every step:

- `settle` waits for `page.waitForLoadState('load')`, then for pending
  microtasks, before each comparison. Pass `settle` to wait for something
  specific, such as `(page) => expect(page.locator('#step')).toBeVisible()`.
  Playwright discourages waiting for `'networkidle'`.
- `advance` calls `page.clock.runFor(ms)`. Call `page.clock.install()` before
  navigating for it to have an effect.
- The page oracles fail the step when the page threw an uncaught exception,
  logged a console error, left a promise rejection unhandled, or received a
  response with a status of 400 or above.

The page oracles are checked after every stable step. Choose them with
`oracles`. In the object form, oracles you leave out are off:

```ts
sut: createPlaywrightSut(page, {
  events,
  read,
  projectModel,
  // Fail on console warnings too, and only on server errors.
  oracles: { pageError: true, console: 'warn', http: 500, unhandledRejection: true }
})
```

`oracles: false` turns them all off. Responses to requests that a `mocks`
route handled are not checked, so a mocked `500` does not fail the step. A
failing oracle fails the run with `SUT check failed after N steps`, and its
cause is a `PlaywrightOracleError` whose `messages` list what the page
reported.

To attach failure artifacts to the Playwright report, pass the `testInfo`
fixture:

```ts
test('the form matches its model', async ({ page }, testInfo) => {
  await propertyTest(formMachine, {
    events,
    sut: createPlaywrightSut(page, {
      events: formActions,
      read,
      projectModel,
      testInfo,
      step: (name, body) => test.step(name, body)
    })
  });
});
```

With `testInfo`, every run records a Playwright trace. When the campaign
fails, the failing run's trace, a `fixture.json` with the `TestFixture`, and
a screenshot of the page are attached. The failing run is the shrunk
counterexample. `trace: 'on'` also attaches the last run's trace when the
campaign passes, and `screenshots: 'every-step'` attaches one screenshot per
stable step of the failing run. `step` wraps each event action, so the report
lists one step per event.

To stub network calls per event case, use `mocks`. The key is
`"<type>.<case>"` or `"<case>"`:

```ts
events: {
  SUBMIT: [
    { case: 'ok', generate: fc.constant({}) },
    { case: 'error', generate: fc.constant({}) }
  ]
},
sut: createPlaywrightSut(page, {
  events: { SUBMIT: (page) => page.click('#submit') },
  mocks: {
    'SUBMIT.ok': (page) =>
      page.route('**/api/submit', (route) => route.fulfill({ status: 200 })),
    'SUBMIT.error': (page) =>
      page.route('**/api/submit', (route) => route.fulfill({ status: 500 }))
  },
  read,
  projectModel
})
```

A mock runs before the event action, only when the resolved case differs from
the last one applied. Routes a mock installs are removed before another case's
mock is applied and when the run ends.
[`examples/property-testing-playwright`](../../examples/property-testing-playwright)
is a runnable version. All options are listed under
[`createPlaywrightSut()`](#createplaywrightsut) in the reference.

### Run model tests with Vitest

`@xstate/test/vitest` registers a model test in one call. `it.model` runs
`propertyTest()`, and `it.paths` runs `testPaths()`:

```ts
import { it } from '@xstate/test/vitest';

it.model('the cart matches the model', cartMachine, {
  events,
  sut: cartSut
});

it.paths('every path matches the model', cartMachine, {
  pathGenerator: 'simple',
  events,
  sut: cartSut,
  stopWhen: (snapshot) =>
    Object.values(snapshot.context.items).some((qty) => qty >= 2)
});
```

Each test:

- saves failures, keyed by the test file and the test's full name, and
  replays them first on the next run. See
  [Save failures and replay them first](#save-failures-and-replay-them-first).
  Pass `failures: false` to turn this off, or `failures: { dir, replay }` to
  change the directory or the replay mode.
- sets the test timeout to `until.timeMs` plus 5 seconds when `until` has a
  `timeMs`. A fourth argument sets the timeout explicitly.
- prints `formatTestCoverage(coverage)` when the campaign fails.
- stores `testCoverageToJSON(coverage)` as `task.meta.xstateTestCoverage`,
  where custom reporters can read it.

`it.model.fails` passes only when the campaign fails, and, with `message`,
only when the failure message matches:

```ts
it.model.fails('finds the remove bug', cartMachine, buggyOptions, {
  message: /Property observation diverged/
});
```

`it` and `test` from `@xstate/test/vitest` use Vitest's global `it` and
`test`, so they need `test.globals: true`. Without globals, wrap Vitest's own:

```ts
import { it as vitestIt } from 'vitest';
import { withModelTests } from '@xstate/test/vitest';

const it = withModelTests(vitestIt);
```

`vitest` is an optional peer dependency. `@xstate/test/vitest` imports only
its types.

### Check liveness and reachability

`always` and `never` check every step. Three more checks cover behavior that
must happen:

- `respond` requires every step on which `trigger` holds to be followed,
  within `within` steps, by a step on which `response` holds. The response may
  hold on the trigger step itself.
- `sometimes` requires the predicate to hold on at least one step of at least
  one run. A run in which it never holds does not fail; the campaign fails
  when no run satisfied it.
- `reachable` lists states that at least one run must enter, as state values,
  state node ids, or tags.

This cart machine invokes `pay` from a `paying` state, which moves to `done`
on success and back to `shopping` on failure, as in the
[cart example](../../examples/property-testing-cart):

```ts
const whileShopping = ({ snapshot }) => snapshot.matches('shopping');

await propertyTest(cartMachine, {
  events: {
    ADD: { generate: fc.record({ sku }), when: whileShopping },
    CHECKOUT: { generate: fc.constant({}), when: whileShopping }
  },
  mode: 'executed',
  outcomes: {
    pay: fc.oneof(
      fc.constant({ ok: true as const, output: {} }),
      fc.constant({ ok: false as const, error: 'declined' })
    )
  },
  temporal: [
    {
      type: 'respond',
      id: 'payment-settles',
      within: 1,
      trigger: ({ snapshot }) => snapshot.matches('paying'),
      response: ({ snapshot }) => !snapshot.matches('paying')
    },
    {
      type: 'sometimes',
      id: 'declined',
      predicate: ({ snapshot }) => snapshot.context.lastError !== null
    }
  ],
  reachable: ['#cart.done']
});
```

`payment-settles` holds because `when` offers the cart's events only while
shopping: after `CHECKOUT`, the next step is the payment's outcome. Without
`when`, an `ADD` the machine ignores while paying would be a step without a
response.

When no run satisfies a `sometimes` property or enters a `reachable` state,
the campaign throws a `TestCampaignError`:

```
Campaign assertions failed:
  - sometimes "declined" did not hold in 100 run(s)
  - reachable "#cart.done" was not entered in 100 run(s)
```

`coverage.temporal.counts` records, per property, how many runs satisfied it,
failed it, and ended before it was decided. A `reachable` target appears as
`reachable:<target>`.

A bounded property whose `within` is larger than the longest sequence a
campaign can produce can never fail. The campaign lists it in
`coverage.temporal.warnings`, and `formatTestCoverage()` prints the warning
under `temporal`:

```
temporal: 1 satisfied, 0 failed, 0 inconclusive
  - checks-out: 2 satisfied, 0 failed, 23 inconclusive
  warning: eventually "checks-out" has within 20, but the longest sequence is 10 steps, so it can never fail
```

The longest sequence is `maxCommands` for `propertyTest()`, plus the longest
frontier prefix, and the longest path for `testPaths()`.

### Gate CI on coverage

`assertTestCoverage()` throws when a dimension's ratio of
`covered / (covered + uncovered)` is below its threshold. The error message
contains the formatted report:

```ts
const { coverage } = await propertyTest(cartMachine, { events, sut: cartSut });

assertTestCoverage(coverage, { transitions: 1, stateNodes: 1 });
```

To stop a campaign as soon as coverage is reached, use `until`. Runs are
executed in batches of `batchRuns` (default `25`), up to `maxRuns` (default
`100`), and the condition is checked between batches:

```ts
const { coverage } = await propertyTest(cartMachine, {
  events,
  sut: cartSut,
  until: { transitions: 1 },
  maxRuns: 500
});

coverage.exploration.stoppedBecause; // 'until', 'budget', or 'failure'
```

Write reports as CI artifacts with the formatters. Each is deterministic for
the same coverage:

```ts
import { writeFile } from 'node:fs/promises';
import {
  formatTestCoverage,
  formatTestCoverageHTML,
  formatTestCoverageJUnit,
  testCoverageToJSON
} from '@xstate/test';

await writeFile('coverage.md', formatTestCoverage(coverage, { format: 'markdown' }));
await writeFile('coverage.json', JSON.stringify(testCoverageToJSON(coverage)));
await writeFile('coverage.xml', formatTestCoverageJUnit(coverage, { suiteName: 'cart' }));
await writeFile('coverage.html', formatTestCoverageHTML(coverage, { title: 'Cart' }));
```

The JUnit report has one `<testcase>` per transition and per state node:
`<failure>` for uncovered ids and `<skipped>` for unreachable or unknown ones.

To require that generated sequences reach a situation often enough, record it
with `classify()` or `label()` and set `expectLabels`:

```ts
await propertyTest(cartMachine, {
  events,
  invariant: ({ snapshot, classify }) => {
    classify(Object.keys(snapshot.context.items).length >= 2, 'two-skus');
  },
  expectLabels: { 'two-skus': { min: 0.1 } }
});
```

`min` is the share of attempted runs, from `0` to `1`, that recorded the label
at least once. `minCount` is a minimum total number of occurrences. Shrink
attempts are not counted.

### Inspect the distribution of generated data

`statistics: true` prints how executed events split across event cases, and
the share of runs that recorded each label, after a passing campaign:

```ts
await propertyTest(cartMachine, {
  seed: 1,
  events,
  statistics: true,
  invariant: ({ snapshot, classify }) => {
    classify(Object.keys(snapshot.context.items).length >= 2, 'two-skus');
  }
});
```

```
Test statistics (100 runs)

event cases (share of executed events):
   32.6%  ADD / default: 115 executed, 39 ignored
   35.7%  CHECKOUT / default: 126 executed, 44 ignored
   31.7%  REMOVE / default: 112 executed, 35 ignored

labels (share of runs):
   14.0%  two-skus: 26 recorded
```

`formatTestStatistics(coverage)` returns the same text for any coverage
object. Runs started while fast-check shrinks a counterexample are left out
of the labels and the event cases; `coverage.exploration.shrinkRuns` counts
them.

### Replay a failure

A `ModelTestFailure` carries a `fixture`: a JSON-safe record of the sequence
that failed. Save it, and replay it with `replayTest()`:

```ts
import { ModelTestFailure, replayTest, type TestFixture } from '@xstate/test';
import fixture from './cart-failure.json';

test('regression: removing an item', async () => {
  await expect(
    replayTest(cartMachine, fixture as TestFixture, { sut: cartSut })
  ).rejects.toBeInstanceOf(ModelTestFailure);
});
```

`replayTest()` stops at the recorded failing step and throws the reproduced
failure. When the failure no longer happens, it throws
`ReplayNotReproducedError`. Pass `expect: 'pass'` to require that the whole
fixture replays without failing, which is how a fixed regression is kept:

```ts
await replayTest(cartMachine, fixture as TestFixture, {
  sut: cartSut,
  expect: 'pass'
});
```

Fixtures from executed runs record every invoke outcome, and replay stubs
those sources, so no real service is called. The machine's `id` and `version`
are checked against the fixture.

To rerun the same fast-check sequence instead, pass the recorded `seed`,
`path`, and `replayPath` back to `propertyTest()`:

```ts
await propertyTest(cartMachine, {
  events,
  sut: cartSut,
  seed: failure.replay!.seed,
  path: failure.replay!.path,
  replayPath: failure.replay!.replayPath
});
```

This depends on the same generators and the same fast-check version, which
the fixture does not.

### Save failures and replay them first

`failures` saves the fixture of a failing campaign to disk, and replays saved
fixtures before the next campaign:

```ts
await propertyTest(cartMachine, {
  events,
  sut: cartSut,
  failures: { dir: '.xstate-test', key: 'cart-store' }
});
```

A failing campaign writes `<dir>/<key>/<hash>.json`, with the fixture, the
summary, and the fast-check seed, and adds a line to the failure message.
`<hash>` is the first 12 hexadecimal digits of the fixture's SHA-256 hash:

```
Saved: .xstate-test/cart-store/<hash>.json
```

The next campaign replays every saved fixture with `replayTest()` before it
generates anything. A fixture that still fails throws that failure at once,
with `(replayed from <file>)` added to its summary. A fixture that no longer
fails is deleted, and the campaign runs.

| Option | Default | Description |
| --- | --- | --- |
| `dir` | `'.xstate-test'` | The directory failures are saved in. |
| `replay` | `'first'` | `'first'` replays saved fixtures, then runs the campaign. `'only'` replays them and skips the campaign. `false` saves without replaying. |
| `key` | machine id and a hash | The subdirectory of `dir`. Defaults to the machine's `id` plus a hash of the event cases, the oracles configured, and the mode. |

`failures: true` uses the defaults. `testPaths()` accepts the same option.
Two tests that run the same machine with different oracles, such as a
`sut` that differs only in its implementation, share the default key; set
`key` so each replays only its own failures.

Add `.xstate-test/` to `.gitignore` to keep failures local, or commit it so
CI replays the failures found on developer machines first. A run that
starts from a `start` snapshot is not saved.

`createFailureDatabase(options)` returns the store `failures` creates. Any
object with `load(key)`, `onFailure(fixture, key, failure)`, and optionally
`remove(stored, key)` works as a store, such as one backed by a database;
this is the `TestFailureStore` that `xstate/graph` accepts.

### Record an offline regression suite

`generateTestSuite()` runs a passing campaign and keeps a small set of fixtures
that preserves the covered transitions, state nodes, and guards:

```ts
import { writeFile } from 'node:fs/promises';
import { generateTestSuite, serializeTestSuite } from '@xstate/test';

const suite = await generateTestSuite(cartMachine, {
  seed: 1,
  numRuns: 200,
  events,
  sut: cartSut
});
await writeFile('cart.suite.json', serializeTestSuite(suite));
```

Replaying needs only `xstate/graph`, so CI does not need fast-check:

```ts
import { readFile } from 'node:fs/promises';
import { describeTestSuite, parseTestSuite } from 'xstate/graph';

const suite = parseTestSuite(await readFile('cart.suite.json', 'utf8'));

describeTestSuite(suite, cartMachine, { invariant: () => {}, sut: cartSut });
```

`describeTestSuite()` registers one test per fixture with the global `it` and
`describe` of Vitest or Jest; pass `it` and `describe` to use others.
`replayTestSuite()` replays every fixture and resolves with
`{ passed, failed }` instead. Every fixture is expected to pass.

### Test concurrency

A sequential run sends one event at a time, so it never observes a race. Three
tools look for concurrency bugs.

`scheduler: true` gives every run an `fc.scheduler()`. Wrap the SUT with
`withScheduledSut()` and its `send`, `read`, `settle`, and `advance` calls
resolve in an order fast-check chooses. Schedule the SUT's own background work
on `getCurrentScheduler()`. This SUT commits each increment asynchronously, so
some orderings let `read()` return a stale count, and the campaign fails:

```ts
import { getCurrentScheduler, withScheduledSut } from '@xstate/test';

await propertyTest(counterMachine, {
  scheduler: true,
  deriveEvents: false,
  events: { INC: fc.record({ by: fc.constant(1) }) },
  sut: withScheduledSut({
    create: () => {
      const scheduler = getCurrentScheduler()!;
      let count = 0;
      return {
        send: () => {
          void scheduler.schedule(Promise.resolve(), 'commit').then(() => {
            count++;
          });
        },
        read: () => count
      };
    },
    projectModel: (snapshot) => snapshot.context.count
  })
});
```

The ordering of a failing run is recorded as `failure.replay.data.scheduler`.
Rebuild it with `fc.schedulerFor(ordering)`. Only work that goes through the
scheduler is reordered.

`checkLinearizable(history, model)` decides whether a history of overlapping
operations could have come from some sequential order:

```ts
import { checkLinearizable } from '@xstate/test';

const result = checkLinearizable(
  [
    { id: 'a', invocation: { type: 'write', value: 1 }, response: undefined, start: 0, end: 4 },
    { id: 'b', invocation: { type: 'read' }, response: 1, start: 1, end: 5 }
  ],
  {
    initial: 0,
    apply: (state: number, event: { type: string; value?: number }) =>
      event.type === 'write'
        ? { state: event.value!, response: undefined }
        : { state, response: state }
  }
);

result.linearizable; // true
result.witness; // the sequential order that explains the history
```

`truncated: true` means the search stopped at `maxExplored` (default `100000`)
before deciding. It is not proof of a bug.

`runParallelPropertyCommands(machine, options)` runs a sequential `prefix`,
then runs `branches` concurrently against the SUT, and checks the recorded
history against the machine's own `transition()`:

```ts
import { runParallelPropertyCommands } from '@xstate/test';

const result = await runParallelPropertyCommands(counterMachine, {
  prefix: [{ type: 'INC', by: 1 }],
  branches: [[{ type: 'INC', by: 1 }], [{ type: 'INC', by: 2 }]],
  sut: {
    create: () => {
      let count = 0;
      return {
        send: async (event) => (count += event.type === 'INC' ? event.by : 0)
      };
    },
    projectModel: (snapshot) => snapshot.context.count
  }
});

result.linearizable; // true
```

When `send` resolves to `undefined`, the response is read with `read()`.

### Steer exploration

These `propertyTest()` options change which sequences a campaign generates.

`weight` on an event case or command changes how often it is drawn, relative
to the others:

```ts
events: {
  ADD: { generate: fc.record({ sku }), weight: 5 },
  REMOVE: fc.record({ sku }),
  CHECKOUT: { generate: fc.constant({}), weight: 0.5 }
}
```

`frontiers` starts runs from paths that reach a state of interest. The prefix
is replayed as-is, and shrinking only shortens the generated continuation:

```ts
const model = createTestModel(cartMachine);

await propertyTest(model, {
  events,
  frontiers: {
    paths: model.getShortestPaths({
      toState: (snapshot) => Object.keys(snapshot.context.items).length > 0,
      stopWhen: (snapshot) =>
        Object.values(snapshot.context.items).some((qty) => qty >= 2)
    }),
    runsPerFrontier: 50
  }
});
```

`frontiers: 'auto'` does this for coverage. Between batches, it finds the
shortest path to each state node that still owns an uncovered transition and
uses those paths as prefixes. Combine it with `until`:

```ts
await propertyTest(cartMachine, {
  events,
  frontiers: 'auto',
  until: { transitions: 1 },
  maxRuns: 200
});
```

`swarm: true` enables a seeded random subset of at least half the event cases
in each run, so frequent events do not crowd out rare combinations. The
enabled cases are recorded on the trace and the fixture, and are frozen while
a failure shrinks.

`target` hill-climbs toward high values of a number. With
`frontiers: { strategy: 'target' }`, the prefixes that reached the best values
become the next batch's frontiers:

```ts
const { coverage } = await propertyTest(cartMachine, {
  events,
  target: ({ snapshot }) => snapshot.context.items.apple ?? 0,
  frontiers: { strategy: 'target' },
  until: (coverage) => coverage.exploration.target.best >= 8,
  maxRuns: 400
});
```

### Start from a snapshot or input

`input` is passed to the machine's initial transition in every run. `start`
starts every run from an existing snapshot instead, and requires
`serializeSnapshot` so fixtures can record the start:

```ts
const [cartWithApple] = transition(
  cartMachine,
  initialTransition(cartMachine)[0],
  { type: 'ADD', sku: 'apple' }
);

await propertyTest(cartMachine, {
  events,
  start: {
    snapshot: cartWithApple,
    serializeSnapshot: (snapshot) => snapshot.context
  }
});
```

Replaying such a fixture requires `restoreSnapshot`, which turns the recorded
value back into a snapshot.

### Write a custom adapter

`propertyTest()` from `@xstate/test` uses the built-in fast-check adapter.
`propertyTest()` from `xstate/graph` takes any `adapter`: an object with a
`run(request)` method that drives runners and returns a result. See
[`TestAdapter`](#testadapter) in the reference for the request and the runner
lifecycle, and
[`test/randomAdapter.ts`](./test/randomAdapter.ts) for a dependency-free
adapter without shrinking.

## Reference

### Exports

`@xstate/test` re-exports everything from `xstate/graph` and adds the
fast-check integration:

| Export | Description |
| --- | --- |
| `propertyTest(source, options)` | Runs a random-sequence campaign. Resolves with `{ coverage }`. |
| `testPaths(source, options?)` | Runs generated paths. Resolves with `{ coverage, results }`. |
| `generateTestSuite(source, options)` | Records an offline suite from a passing campaign. |
| `pick(select, toPayload?)` | An event case that picks its payload from the current snapshot, with a fast-check index. |
| `createFailureDatabase(options?)` | The file-system store behind the `failures` option. |
| `fastCheckAdapter(options?)` | The fast-check `TestAdapter`, for `xstate/graph` functions. |
| `extractReplayPath(counterexample)` | Reads `replayPath` from a raw `fc.commands()` counterexample. |
| `eventsFromSchemas(machine, options?)` | Derives the `events` map from `schemas.events`. |
| `arbitraryFromSchema(schema, options?)` | Converts one Zod schema to an arbitrary. |
| `mergeEventGenerators(derived, explicit)` | Merges two `events` maps; explicit entries win. |
| `withScheduledSut(sut)`, `withScheduledReference(reference)` | Route async boundaries through the run's scheduler. |
| `getCurrentScheduler()` | The running `fc.Scheduler`, or `undefined`. |

The `propertyTest()`, `testPaths()`, and `generateTestSuite()` exported here
take fast-check options at the top level, derive events from schemas, and
accept `failures: true` or `{ dir, replay, key }`. The versions in
`xstate/graph` take an explicit `adapter` (or, for `testPaths()`, plain
`(rng) => value` generators), derive nothing, and take a `TestFailureStore`
as `failures`.

From `xstate/graph`, also available from `@xstate/test`:

| Export | Description |
| --- | --- |
| `replayTest(source, fixture, options)` | Replays a `TestFixture`. |
| `ModelTestFailure`, `ReplayNotReproducedError` | Error classes. |
| `formatTestTrace(trace)`, `serializeTestTrace(trace)` | Render a trace as text, or as JSON-safe data. |
| `defaultEquivalent(a, b)` | The default projection comparison. |
| `formatTestCoverage`, `formatTestCoverageJUnit`, `formatTestCoverageHTML`, `testCoverageToJSON`, `formatTestCoverageId` | Coverage reports. |
| `formatTestStatistics(coverage)` | The event-case and label distribution `statistics: true` prints. |
| `TestCampaignError` | Thrown when a `sometimes` property or a `reachable` target is never satisfied. |
| `pick(select, toPayload?)` | `pick()` with a plain `(rng) => index` generator. Shadowed by the fast-check version in `@xstate/test`. |
| `assertTestCoverage(coverage, thresholds)` | Throws when coverage is below thresholds. |
| `replayTestSuite`, `replayTestSuiteFixture`, `describeTestSuite`, `serializeTestSuite`, `parseTestSuite`, `formatTestSuiteFixtureTitle` | Offline suites. |
| `checkLinearizable(history, model, options?)` | Linearizability check. |
| `runParallelPropertyCommands(machine, options)` | Concurrent branches checked for linearizability. |
| `createTestModel(machine, options?)`, `TestModel` | Path generation and execution on a model. |
| `getShortestPaths`, `getSimplePaths`, `getPathsFromEvents` | Path generators. |
| `fromTestParam(testParam)` | Converts a 1.0 beta `{ events, states }` object to a `sut`. Deprecated. |

Names with a `Property` prefix that also exist with a `Test` prefix, such as
`PropertyCoverage` and `formatPropertyCoverage()`, are deprecated aliases.

Subpath entrypoints:

| Entrypoint | Exports |
| --- | --- |
| `@xstate/test/playwright` | `createPlaywrightSut`, `PlaywrightOracleError`, and the types `PlaywrightPage`, `PlaywrightSutConfig`, `PlaywrightEventAction`, `PlaywrightMock`, `PlaywrightOracles`, `PlaywrightTestInfo`. |
| `@xstate/test/vitest` | `it` and `test` with `.model` and `.paths`, and `withModelTests`. |
| `@xstate/test/effect-schema` | `eventsFromSchemas` with Effect Schema support, `fromEffectSchema`, `fromEffectSchemas`. |
| `@xstate/test/schema` | `eventsFromSchemas`, `arbitraryFromSchema`, `mergeEventGenerators`. |

### Shared options

`propertyTest()`, `testPaths()`, and `generateTestSuite()` accept these
(`TestOptions`):

| Option | Default | Description |
| --- | --- | --- |
| `events` | `{}` | Event types and their generators. See [Events](#events). |
| `deriveEvents` | `true` | Derives generators for event types with a runtime schema that `events` does not configure. `@xstate/test` only. |
| `sut` | none | The system under test. See [`sut`](#sut). |
| `states` | none | Per-state assertions, run after every stable step. |
| `invariant` | none | `(context) => void`. Throws to fail the step. |
| `temporal` | `[]` | Temporal properties. See [Temporal properties](#temporal-properties). |
| `reachable` | none | State values, `'#id'` state node ids, or tags that at least one run must enter. |
| `failures` | none | Saves failing fixtures and replays them first. `true`, `{ dir?, replay?, key? }`, or a `TestFailureStore`. |
| `statistics` | `false` | Prints `formatTestStatistics(coverage)` after a passing campaign. |
| `reference` | none | A second implementation compared with the model. |
| `mode` | `'pure'` | `'pure'` or `'executed'`. See [Modes](#modes). |
| `actors` | none | Logic substituted for named actor sources. Executed mode only. |
| `outcomes` | none | Invoke sources replaced by stubs, with generators of `{ ok, output }` or `{ ok, error }`. |
| `input` | none | Machine input for every run. |
| `start` | none | `{ snapshot, serializeSnapshot }` to start every run from a snapshot. |
| `target` | none | `(context) => number`, recorded on every stable step for targeted search. |
| `collect` | none | `(trace, { passed, runIndex })`, called after every run. |
| `expectLabels` | none | `{ [label]: { min?, minCount? } }`. Fails the campaign when a label is too rare. |

The `invariant`, `temporal`, and `target` functions receive a
`TestInvariantContext`: `snapshot`, `previousSnapshot`, `initialSnapshot`,
`event`, `effects` (the actions the step produced), `step`, and `label()`,
`classify()`, and `target()`.

### `testPaths()` options

In addition to the shared options (`PathOptions`):

| Option | Default | Description |
| --- | --- | --- |
| `pathGenerator` | `'shortest'` | `'shortest'`, `'simple'`, or a custom `PathGenerator`. |
| `paths` | none | Runs these paths instead of generating any. |
| `fromEvents` | none | Runs the single path built from this event sequence. |
| `samples` | `3` | Payloads sampled from each event case and outcome generator. An integer of at least `1`. |
| `seed` | `0` | Sampling seed. Each case samples from its own stream, so adding a case leaves the other cases' payloads unchanged. |
| `limit` | `10_000` | Traversal steps before path generation throws. A context that grows without bound reaches it; merge states with `serializeState` or prune with `stopWhen`. |
| `stopWhen` | none | Stops expanding a state when it returns `true`. |
| `toState` | none | Keeps only paths that end in a matching state. |
| `fromState` | initial state | Starts traversal from this snapshot. |
| `allowDuplicatePaths` | `false` | Keeps paths that are prefixes of longer paths. |
| `serializeState`, `serializeEvent` | built in | Identity functions for traversal. |

`testPaths()` rejects `commands`. It resolves with `results`, one
`{ path, passed, error }` per path, and sets `coverage.exploration.strategy`
to `'paths'` and `stoppedBecause` to `'paths'`. It throws on the first failing
path.

After every step, the run's snapshot is compared with the snapshot traversal
planned for that step, using `serializeState`. A run that departs from its
path, such as an event the machine no longer accepts or a service that
resolved on its own, fails with
`Path diverged at step N: expected <state>, got <state>`.

### `propertyTest()` options

In addition to the shared options (`PropertyOptions`):

| Option | Default | Description |
| --- | --- | --- |
| `commands` | none | Generators for `advance` (milliseconds), `checkpoint` (`{ label? }`), and `stop` (`{}`) commands. Each may be `{ generate, weight }`. |
| `until` | none | Stop condition. See below. Enables batching. |
| `batchRuns` | `25` | Runs per batch when batching. |
| `maxRuns` | `100` | Total runs when batching. In `@xstate/test`, defaults to `numRuns` when that is set. |
| `frontiers` | none | An array of paths, `{ paths, select?, runsPerFrontier? }`, `'auto'`, `{ strategy: 'uncovered', maxFrontiers?, runsPerFrontier?, limit? }`, or `{ strategy: 'target', maxFrontiers?, runsPerFrontier? }`. |
| `swarm` | `false` | `true`, or `{ minCases?, seed? }`. |
| `adapter` | fast-check | Replaces the generator engine. Required in `xstate/graph`. |

Without `until` and without `frontiers: 'auto'` or `{ strategy: 'target' }`,
the adapter runs once with its own `numRuns`.

`until` is a function `(coverage) => boolean`, or an object in which every
key must hold:

| Key | Holds when |
| --- | --- |
| `stateNodes`, `transitions`, `transitionPairs`, `guards`, `requirements` | `covered / (covered + uncovered)` is at least the value. |
| `eventCases` | The share of event cases executed at least once is at least the value. |
| `runs` | At least this many runs completed. |
| `timeMs` | At least this many milliseconds elapsed. |
| `any` | At least one of the listed conditions holds. |

`frontiers` defaults: `maxFrontiers` is `5`, `runsPerFrontier` is an even
split of the batch, and `limit` is `1000`. `swarm` defaults: `minCases` is
half the declared cases, rounded up, and `seed` is `0`.

### fast-check options

`propertyTest()` and `generateTestSuite()` from `@xstate/test` pass these
options to fast-check:

| Option | Description |
| --- | --- |
| `seed`, `path`, `replayPath` | Reproduce a run. `replayPath` is the `fc.commands()` replay path. |
| `numRuns` | Runs per adapter call. fast-check defaults to `100`. |
| `maxCommands` | Maximum generated commands per run. |
| `scheduler` | `true` or `{ act }`. See [Test concurrency](#test-concurrency). |
| `endOnFailure`, `interruptAfterTimeLimit`, `markInterruptAsFailure`, `skipAllAfterTimeLimit`, `timeout`, `maxSkipsPerRun` | Run limits. |
| `reporter`, `asyncReporter` | Called with fast-check's run details after every adapter run: once per campaign, or once per batch with `until` or `frontiers`. |
| `verbose`, `includeErrorInReport` | With `verbose` set to `1` (or `true`) or above, the failure message ends with fast-check's report, `fc.defaultReportMessage()`. |
| `randomType`, `unbiased`, `skipEqualValues`, `ignoreEqualValues`, `plugins` | Generation. |

### `sut`

`TestSut`:

| Member | Description |
| --- | --- |
| `create(context)` | Creates a session for one run. `context` has `logic`, `input`, `snapshot` (the start snapshot, if any), `label`, `classify`, and `target`. |
| `projectModel(snapshot)` | Projects the model snapshot to compare with `read()`. |
| `projectSut(observed)` | Normalizes the value from `read()`. Defaults to identity. |
| `equivalent(model, observed)` | Compares the projections. Defaults to `defaultEquivalent`. |
| `complete({ passed, failure })` | Called once when the campaign ends, after every session was disposed. `failure` is the error the campaign throws. |

`TestSutSession`, returned by `create()`:

| Member | Description |
| --- | --- |
| `send(event, context)` | Performs the event. `context.snapshot` is the model snapshot after the event. `context.case` is `{ type, name }` for generated events. |
| `read()` | Reads the observable state for comparison. |
| `states` | Per-state assertions, `(snapshot, session) => void`. Replaces the top-level `states`. |
| `settle()` | Waits for quiescence before each comparison. |
| `advance(ms)` | Advances the SUT's clock and returns the events that fired. |
| `checkpoint(label?)` | Handles a `checkpoint` command. |
| `stop()` | Handles a `stop` command. |
| `check()` | Runs after every stable step, after the comparison. Throws to fail the step with `SUT check failed after N steps`. |
| `dispose({ passed, failure })` | Tears the session down at the end of the run. `failure` is the run's `ModelTestFailure`, when an oracle failed. |

`reference` has the same structure: `create()` returns
`{ transition(event), read(), stop?, dispose? }`, and `projectModel` is
required.

### Temporal properties

Each property has a `type`, an `id`, and an optional `description`, and is
checked on every stable step:

| `type` | Fields | Fails when |
| --- | --- | --- |
| `always` | `predicate` | `predicate` is false on some step. |
| `never` | `predicate` | `predicate` is true on some step. |
| `eventually` | `predicate`, `within?` | `predicate` is not true within `within` steps, or before the run ends. |
| `until` | `hold`, `until`, `within?` | `hold` stops holding before `until` holds, or `until` does not hold within `within` steps or before the run ends. |
| `respond` | `trigger`, `response`, `within?` | A step on which `trigger` holds is not followed by a step on which `response` holds within `within` steps, or before the run ends. The response may hold on the trigger step. |
| `sometimes` | `predicate` | `predicate` holds on no step of any run. Checked when the campaign ends. |

With `within`, a run that ends before `within` steps is **inconclusive**, not
failed. An id that is inconclusive in every run and satisfied in none is
listed in `coverage.temporal.inconclusive`.

### Coverage

`TestCoverage`:

| Field | Description |
| --- | --- |
| `states`, `stateNodes`, `configurations`, `statuses`, `eventTypes`, `transitions`, `frontiers` | `TestCoverageDimension`: `counts`, `covered`, `uncovered`, `unreachable`, `unknown`. |
| `guards` | A dimension plus `outcomes`: `{ [guardId]: { passed, failed } }`. |
| `transitionPairs` | A dimension of `"<first> -> <second>"` ids plus `truncated`. Only pairs of transitions with static targets are declared up front, up to 2,000; a pair involving a transition whose target is computed by a function appears once a run takes it. |
| `requirements` | A dimension of `meta.requirements` ids plus `sources`, the state nodes and transitions that declare each id. |
| `eventCases` | `{ [caseId]: { weight, generated, applicable, executed, ignored } }`. |
| `dynamicTransitions` | Hits and observed targets for transitions whose target is computed. |
| `labels` | `{ [name]: { count, values, share } }`. `share` is the fraction of attempted runs that recorded the label. Shrink attempts are not counted. |
| `temporal` | `satisfied`, `failed`, and `inconclusive` property ids; `counts`, `{ [id]: { satisfied, failed, inconclusive } }` in runs; and `warnings` for bounds that can never fail. |
| `exploration` | `TestExplorationBounds`. See below. |
| `runs`, `steps`, `skipped`, `prefixSteps`, `generatedSteps`, `invariantChecks`, `temporalChecks`, `clockAdvances`, `checkpoints`, `stops`, `sutComparisons`, `oracleComparisons` | Counters. |

`exploration`:

| Field | Description |
| --- | --- |
| `strategy` | `'property'` or `'paths'`. |
| `pathCount`, `pathGenerator` | Paths only. |
| `mode` | `'pure'` or `'executed'`. |
| `configuredRuns`, `completedRuns`, `attemptedRuns` | `attemptedRuns` includes shrink attempts. |
| `shrinkRuns` | Runs started after the first failing run, while the counterexample was shrunk. |
| `maximumSequenceLength`, `maximumObservedSequenceLength` | Configured and observed sequence lengths. |
| `frontiers`, `seeds` | Per-frontier budgets, and the adapter seeds and paths used. |
| `swarm` | `{ runs, averageEnabled }`, or `null`. |
| `target` | `{ best, label, improvements }`. `best` is `-Infinity` when unused. |
| `stoppedBecause` | `'until'`, `'budget'`, `'failure'`, `'paths'` (`testPaths()` ran every path), or `'replay'` (`failures.replay` was `'only'`). |
| `truncated`, `truncationReasons` | Why exploration was cut short. |
| `pendingActorSteps` | Executed-mode steps that settled while an invoked or spawned actor's asynchronous work was still in flight. Those timeline entries list the actors in `pendingActors`. |

In executed mode, guard coverage comes from the guarded transitions that were
taken, so `guards.outcomes` stays empty.

Add requirement ids with `meta.requirements` (a string or an array) on state
nodes and transitions. A requirement is covered when any state node or
transition that declares it is covered.

### `ModelTestFailure`

| Field | Description |
| --- | --- |
| `summary` | The short message, such as `Property observation diverged`. `testPaths()` prefixes it with the failing path: `Path 2 (ADD → REMOVE) failed: …`. |
| `message` | `summary` and the cause's message; a `Reproduce:` line with the fast-check `seed`, `path`, and `replayPath`; a `Fixture:` line when `fixture` is set; `Shrunk N time(s)` when fast-check shrank the counterexample; `Saved: <file>` when `failures` saved it; then `formatTestTrace(trace)`, and fast-check's report when `verbose` is set. |
| `trace` | `TestTrace`: `start`, `initialSnapshot`, `timeline`, `events`, `commands`, `steps`, `finalSnapshot`, `finalObservation`, `swarm`, `mode`, `outcomes`. |
| `cause` | The error thrown by the oracle or the SUT. |
| `fixture` | A `TestFixture` for `replayTest()`. |
| `replay` | fast-check metadata: `engine`, `engineVersion`, `seed`, `path`, `replayPath`, `numShrinks`, `data`. |
| `coverage` | Coverage up to the failure. |

`trace.timeline` entries have a `kind`: `'event'`, `'command'` (`advance`,
`checkpoint`, `outcome`, `stop`), or, in executed mode, `'actorEvent'` for a
transition the actor system made on its own.

`formatTestTrace(trace, { formatSnapshot })` prints one line per entry:
`N. <origin> <event> -> <state>`. The origin is `generator`, `prefix`, or
`clock` for sent events, `timer` for `xstate.after` events and `advance`
commands, `outcome` for invoke results, and `actor(<id>)` for a child actor's
own transition. `<state>` is `formatSnapshot(snapshot)`, which defaults to
`{ value, context }`; pass `formatSnapshot` to `propertyTest()`,
`testPaths()`, or `replayTest()` to print something else. A step whose SUT or
reference observation differs from the model adds `model:` and `observed:`
lines.

### `TestFixture`

```ts
interface TestFixture {
  formatVersion: 2;
  machine?: { id?: string; version?: string };
  start: { type: 'input'; input: unknown } | { type: 'snapshot'; snapshot: unknown };
  timeline: { kind: 'event' | 'command'; command: TestCommand }[];
  failedAt?: number; // absent on fixtures from passing runs
  temporalFailure?: { type; id; description?; within?; atStep: number };
  swarm?: string[];
  mode?: 'pure' | 'executed';
  outcomes?: { src: string; occurrence: number; outcome: TestActorOutcome }[];
  stubs?: string[]; // invoke sources the run stubbed, resolved or not
}
```

Errors in commands and outcomes are recorded as
`{ xstate$$error: true, name, message }`, since `JSON.stringify()` turns an
`Error` into `{}`. `replayTest()` turns them back into `Error` objects.

A `TestCommand` is `{ type: 'event', event, phase, origin, caseId? }`,
`{ type: 'advance', milliseconds, deliveredEvents }`,
`{ type: 'checkpoint', label? }`, `{ type: 'outcome', src, outcome }`, or
`{ type: 'stop' }`. Events delivered by a SUT clock appear twice: in the
`advance` command's `deliveredEvents`, and as the following `event` entries
with `origin: 'clock'`. `replayTest()` rejects a fixture in which the two
disagree.

### `replayTest()`

`replayTest(source, fixture, options)` resolves with the replayed `TestTrace`.

| Option | Default | Description |
| --- | --- | --- |
| `expect` | `'failure'` | `'failure'` stops at `failedAt` and throws the reproduced failure, or `ReplayNotReproducedError`. `'pass'` replays everything and lets any failure through. |
| `invariant`, `temporal`, `sut`, `reference`, `states` | none | The oracles to replay against. |
| `mode` | the fixture's mode | `'executed'` replays against a real actor with recorded outcomes stubbed. |
| `actors` | none | Logic to provide before replaying. Executed mode only. |
| `restoreSnapshot` | none | Required for fixtures that start from a snapshot. |

### `TestSuite`

`{ formatVersion: 1, machineId?, machineVersion?, generatedAt?, fixtures, coverage }`,
where `coverage` is `testCoverageToJSON()` of the whole campaign.
`generateTestSuite()` takes the `propertyTest()` options plus:

| Option | Default | Description |
| --- | --- | --- |
| `select` | `'minimal'` | `'minimal'` keeps the smallest greedy subset of traces that preserves the covered set. `'all'` keeps every distinct trace. |
| `maxFixtures` | none | Upper bound on fixtures. |
| `generatedAt` | none | Recorded as-is. Omit it to keep the file byte-stable. |

### `TestAdapter`

`TestAdapter.run(request)` receives:

| Field | Description |
| --- | --- |
| `events` | `{ type, caseId, generator, weight }` per event case. |
| `commands` | `{ type, generator, weight, src? }` per configured command. `type` is `'advance'`, `'checkpoint'`, `'stop'`, or `'outcome'`; `src` is set for `'outcome'`. |
| `runBudget` | Runs to use, when a frontier or batch fixes it. |
| `runOffset` | Runs completed by earlier batches. Offset a fixed seed by it. |
| `createEvent(type, payload)` | Builds a typed event. |
| `createRunner()` | Creates a `PropertyScenarioRunner` for one run or shrink attempt. |

Each run:

1. `createRunner()`, then `await runner.start()`.
2. For each step: an event (`runner.canRunGenerated(type, generated, caseId)`,
   then `await runner.runGenerated(type, generated, caseId)`), a command
   (`runner.canRunCommand(true)`, then `advance(ms)`, `checkpoint(label)`, or
   `stop()`), or an outcome (`runner.canRunOutcome()`, then
   `outcome(src, outcome)`).
3. `runner.finish()`.
4. `await runner.dispose()`, always.

`run()` resolves with `{ runs, exploration, error?, replay? }`.
`exploration` has `configuredRuns`, `maximumSequenceLength`, and optionally
`engine`, `seed`, `path`, `truncated`, and `truncationReasons`.

### `eventsFromSchemas()`

`eventsFromSchemas(machine, options?)`:

| Option | Default | Description |
| --- | --- | --- |
| `eventsWithoutSchema` | `'empty'` | `'empty'` generates `{}` for handled event types with no schema. `'skip'` leaves them out. |
| `fallback` | none | `(schema, path) => arbitrary \| undefined` for unrecognized schemas. |

Supported Zod (v3 and v4) kinds: `object`, `interface`, `string`, `number`,
`int`, `bigint`, `boolean`, `date`, `literal`, `enum`, `nativeEnum`, `union`,
`array`, `set`, `tuple`, `record`, `optional`, `nullable`, `default`,
`prefault`, `catch`, `readonly`, `nonoptional`, `lazy`, `null`, `undefined`,
`void`, `any`, and `unknown`. Mapped checks: lengths, numeric ranges, `int`,
`multipleOf`, `email`, `uuid`, `url`, `regex`, `startsWith`, `endsWith`,
`includes`, `trim`, `toLowerCase`, and `toUpperCase`. An unsupported kind or
check, a recursive schema, a string with two formats, or a schema that no value
satisfies throws an error naming the schema path, such as `'SET.when'`. A
`type` field in a generated payload is removed.

A handled event type without its own schema key uses the schema of the first
wildcard key it matches, such as `'user.*'`, in both `eventsWithoutSchema`
modes.

### `createPlaywrightSut()`

`createPlaywrightSut(page, config)` returns a `TestSut`. `page` is any object
with the parts of Playwright's `Page` the configuration uses; a real `Page` is
assignable.

| Option | Default | Description |
| --- | --- | --- |
| `events` | required | `(page, event) => void` per event type. |
| `read` | none | Projects the page to a value comparable with `projectModel`. |
| `projectModel` | none | Projects the model snapshot. |
| `states` | none | `(page, snapshot) => void` per state key. |
| `projectSut` | identity | Normalizes the value from `read`. |
| `equivalent` | deep equality | Compares the projections. |
| `settle` | `page.waitForLoadState('load')`, then a microtask flush | Runs before each comparison. |
| `advance` | `page.clock.runFor(ms)` | Handles `advance` commands. May return delivered events. |
| `checkpoint` | screenshot | Writes `<screenshotDir>/<label>.png`, or `checkpoint-<n>.png` without a label. |
| `screenshotDir` | `'property-screenshots'` | Directory for checkpoint screenshots. |
| `reset` | none | Runs when a run's session is created. |
| `stop` | none | Handles `stop` commands. |
| `dispose` | none | Runs when a run's session is disposed. |
| `mocks` | none | `(page) => void` per case key, run before the event action. |
| `caseOf` | `event.case ?? event.type` | Mock key for events without a generated case: prefix, clock, and replayed events. |
| `oracles` | `'defaults'` | Page oracles checked after every stable step. `'defaults'` is `{ pageError: true, console: 'error', http: 400, unhandledRejection: true }`. `false`, or an object in which omitted oracles are off. |
| `testInfo` | none | Playwright's `testInfo`. Failure artifacts are attached to it. Required when `trace` or `screenshots` is on. |
| `trace` | `'retain-on-failure'` with `testInfo`, else `'off'` | Records a trace per run with `page.context().tracing`. `'retain-on-failure'` attaches the failing run's trace; `'on'` also attaches the last run's trace of a passing campaign. Left alone when tracing is already running. |
| `screenshots` | `'on-failure'` with `testInfo`, else `'off'` | `'on-failure'` attaches a screenshot of the page at the end of the failing run; `'every-step'` attaches one per stable step of the failing run. |
| `step` | none | `(name, body) => Promise`, such as `(name, body) => test.step(name, body)`. Wraps each event action. |

A failing campaign with `testInfo` also attaches `fixture.json`, the failure's
`TestFixture`.

## Migrating from `@xstate/test` 0.x and 1.0 beta

`@xstate/test` 2.0 requires XState v6. `createTestModel()` and the path
functions moved to `xstate/graph` and are re-exported from `@xstate/test`.

### From 1.0 beta

The 1.0 beta `TestParam` object, `{ events, states }`, is replaced by the `sut`
option. `path.test()` and `model.testPath()` take the same options as
`testPaths()`.

Before:

```ts
const model = createTestModel(machine);

for (const path of model.getShortestPaths()) {
  it(path.description, async () => {
    await path.test({
      events: { SUBMIT: ({ event }) => page.click('#submit') },
      states: { submitted: () => expect(page.locator('#done')).toBeVisible() }
    });
  });
}
```

After:

```ts
const model = createTestModel(machine);

for (const path of model.getShortestPaths()) {
  it(path.description, async () => {
    await path.test({
      sut: {
        create: () => ({
          send: (event) => (event.type === 'SUBMIT' ? page.click('#submit') : undefined),
          states: { submitted: () => expect(page.locator('#done')).toBeVisible() }
        })
      }
    });
  });
}
```

To keep the old object for now, wrap it: `sut: fromTestParam({ events, states })`.
Event executors receive the full typed event.

Or replace the loop with one `testPaths()` call, which adds coverage and
replay fixtures:

```ts
await testPaths(machine, { sut: fromTestParam({ events, states }) });
```

Other changes:

| 1.0 beta | 2.0 |
| --- | --- |
| `createTestMachine(config)` | `createMachine(config)` |
| `path.testSync(params)` | `await path.test(options)` |
| `model.testState(state, params)`, `model.testTransition(step, params)` | The `states` option, checked on every stable step. |
| `TestPathResult`, `TestStepResult` | `TestPathRunResult`: `{ path, passed, error }`. Use `ModelTestFailure.trace` for step detail. |
| `meta.test(testContext, state)` | `meta.test(session, snapshot)`: the first argument is the SUT session. |

### From 0.x

| 0.x | 2.0 |
| --- | --- |
| `createModel(machine).withEvents({ E: { exec, cases } })` | `events: { E: [...] }` for payloads, and `sut.create().send` for `exec`. |
| `model.getShortestPathPlans()`, `plan.paths` | `testPaths(machine, options)`, or `createTestModel(machine).getShortestPaths()`. |
| `model.getSimplePathPlans()` | `testPaths(machine, { pathGenerator: 'simple' })`. |
| `path.test(page)` | `path.test({ sut })`. The SUT session holds the page. |
| `meta.test(page, state)` | `meta.test(session, snapshot)`, or `states` on the session. |
| `model.testCoverage()` | `assertTestCoverage(coverage, { stateNodes: 1 })`. |

`cases` become event cases:

```ts
// 0.x
createModel(machine).withEvents({
  ADD: {
    exec: (page, event) => page.fill('#sku', event.sku),
    cases: [{ sku: 'apple' }, { sku: 'pear' }]
  }
});

// 2.0
await testPaths(machine, {
  events: {
    ADD: [
      { case: 'apple', generate: fc.constant({ sku: 'apple' }) },
      { case: 'pear', generate: fc.constant({ sku: 'pear' }) }
    ]
  },
  samples: 1,
  sut: { create: () => ({ send: (event) => page.fill('#sku', event.sku) }) }
});
```

## Comparison

| | `@xstate/test` 2.0 | fast-check alone | Playwright alone | `@xstate/test` 0.x and 1.0 beta |
| --- | --- | --- | --- | --- |
| Model | An XState machine | Hand-written model and `Command` classes | None | An XState machine |
| Sequences | Graph paths and random sequences | Random sequences | Hand-written scenarios | Graph paths |
| Payloads | Generated, or derived from Zod and Effect schemas | Generated | Hand-written | Fixed `cases` |
| Shrinking | Yes, with `propertyTest()` | Yes | No | No |
| Oracles | SUT comparison, invariants, temporal properties, state assertions, reference | Assertions in each command | Assertions in each test | State assertions |
| Coverage | States, transitions, guards, pairs, requirements, event cases | None | None | State nodes |
| Replay | Portable JSON fixtures, a failure database replayed first, and fast-check seeds | Seeds and paths | Traces | None |
| Invoked actors and delays | `mode: 'executed'` with stubbed outcomes and a simulated clock | Hand-written | Real services and `page.clock` | Not modeled |
| UI | `@xstate/test/playwright` | Manual | Native | Manual executors |
