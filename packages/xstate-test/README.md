# `@xstate/test`

`@xstate/test` 2.0 — model-based and property-based testing for XState, built
on fast-check.

`propertyTest()` generates event and command sequences from a machine, runs
them, and checks invariants and temporal properties after every step. It can
run the model on its own, compare it against a reference implementation, or
drive a real system under test — a class, a server, or a browser page — and
fail when the two diverge. Counterexamples are shrunk to a minimal sequence and
exported as a portable replay fixture.

## Installation

`@xstate/test` has `xstate` and `fast-check` as required peer dependencies:

```bash
pnpm add -D @xstate/test fast-check xstate
```

`zod` and `effect` are optional peer dependencies, needed only to derive event
generators from schemas written with them. `@playwright/test` is an optional
peer dependency of the `@xstate/test/playwright` entrypoint.

## Migrating

- **From `@xstate/fast-check`.** The package was renamed. Rename the import,
  and write fast-check's options at the top level instead of passing
  `adapter: fastCheckAdapter({ ... })`. `fastCheckAdapter` is still exported.
- **From `@xstate/test` 0.x.** `createModel(machine).withEvents({ ... })` is
  replaced by `propertyTest(machine, { events, invariant })`. Event
  configuration moves from `withEvents` to the `events` map, and assertions
  move from per-state `meta.test` functions to `invariant` (or to the `test`
  option, which keeps the `states`/`events` assertion style).
- **From `@xstate/test` 1.0 beta.** `createTestModel()` now lives in
  `xstate/graph`, and is re-exported from `@xstate/test`.

## Getting started

[`examples/property-testing-cart`](../../examples/property-testing-cart) is the
worked version of everything below: a cart machine, a hand-written
implementation to compare it against, and one deliberate bug to find.

Declare the event payloads as schemas, and the generators are derived from
them:

```ts
import { createAsyncLogic, setup, types } from 'xstate';
import * as z from 'zod';

export const cartMachine = setup({
  schemas: {
    context: types<CartContext>(),
    events: {
      ADD: z.object({
        sku: z.string().min(1),
        qty: z.number().int().min(1).max(5)
      }),
      REMOVE: z.object({ sku: z.string() }),
      CHECKOUT: z.object({})
    }
  },
  actors: { pay }
}).createMachine({
  // ...
});
```

`propertyTest()` then only needs the generators you want to control, plus what
must hold:

```ts
import * as fc from 'fast-check';
import {
  assertPropertyCoverage,
  formatPropertyCoverage,
  propertyTest
} from '@xstate/test';

const { coverage } = await propertyTest(cartMachine, {
  seed: 1,
  numRuns: 100,
  maxCommands: 10,
  // `ADD` and `CHECKOUT` come from the machine's Zod event schemas.
  events: { REMOVE: removeAnItemInTheCart },
  // Real actors run, so `pay` resolves and `onDone`/`onError` fire.
  mode: 'executed',
  outcomes: {
    pay: fc.oneof(
      fc.constant({ ok: true, output: { receiptId: 'rcpt_1' } }),
      fc.constant({ ok: false, error: new Error('card declined') })
    )
  },
  invariant: ({ snapshot }) => {
    for (const [sku, qty] of Object.entries(snapshot.context.items)) {
      expect(qty, `quantity of ${sku}`).toBeGreaterThan(0);
    }
  },
  temporal: [
    {
      type: 'eventually',
      id: 'checks-out',
      within: 20,
      predicate: ({ snapshot }) => snapshot.matches('done')
    }
  ],
  // Stop as soon as every transition has been covered.
  until: { transitions: 1 }
});

console.log(formatPropertyCoverage(coverage));
assertPropertyCoverage(coverage, { transitions: 1 });
```

To check a real implementation against the model, add a `sut` and say how to
project both sides to comparable values:

```ts
await propertyTest(cartMachine, {
  seed: 2,
  numRuns: 100,
  maxCommands: 12,
  deriveEvents: false,
  events: {
    ADD: fc.record({
      sku: fc.constantFrom('apple', 'pear', 'plum'),
      qty: fc.integer({ min: 1, max: 5 })
    }),
    REMOVE: removeAnItemInTheCart
  },
  sut: {
    create: () => {
      const store = new CartStore();
      return {
        send: (event: CartEvent) => store.dispatch(event),
        read: () => store.getState().items
      };
    },
    projectModel: (snapshot) => snapshot.context.items
  },
  invariant: () => {}
});
```

## API

<!-- public exports from src/index.ts -->

`propertyTest()` takes the machine, the event generators, and the invariant.
fast-check's own options — `seed`, `numRuns`, `maxCommands`, `replayPath`,
`scheduler`, `endOnFailure`, `interruptAfterTimeLimit` and the rest — are
written at the top level:

```ts
import * as fc from 'fast-check';
import { propertyTest } from '@xstate/test';

await propertyTest(machine, {
  seed: 42,
  numRuns: 1_000,
  events: {
    INC: fc.record({ value: fc.integer() })
  },
  invariant: ({ snapshot }) => {
    if (snapshot.context.count >= 100) {
      throw new Error('count must remain below 100');
    }
  }
});
```

Event-map keys supply each event's `type`; arbitraries generate payloads only.
Each keyed arbitrary is reported as the stable `default` case for that event.
Use descriptors to name several behavioral cases for the same event or limit
when each is applicable:

```ts
events: {
  INC: [
    {
      case: 'positive',
      generate: fc.record({ value: fc.integer({ min: 1 }) }),
      when: ({ snapshot }) => snapshot.matches('active')
    },
    {
      case: 'negative',
      generate: fc.record({ value: fc.integer({ max: -1 }) })
    }
  ]
}
```

For commands that must reference current model resources, generate a shrinkable
symbolic value and resolve it against the pure snapshot. Returning `undefined`
makes that generated command inapplicable:

```ts
events: {
  USE_ACCOUNT: {
    case: 'existing-account',
    generate: fc.nat(),
    resolve: ({ snapshot, generated }) => {
      const accounts = snapshot.context.accountIds;
      if (!accounts.length) return undefined;
      return { accountId: accounts[(generated as number) % accounts.length] };
    }
  }
}
```

FastCheck shrinks the symbolic value and command sequence. XState resolves and
records concrete events, so portable fixtures do not depend on FastCheck or the
resolver.

`propertyTest()` may receive a machine or `createTestModel(machine)`. Existing
shortest or simple paths can establish deterministic frontiers while FastCheck
shrinks only the continuation:

```ts
const model = createTestModel(machine);

await propertyTest(model, {
  maxCommands: 20,
  frontiers: {
    paths: model.getShortestPaths(),
    select: ({ frontier }) => frontier.state.status === 'active',
    runsPerFrontier: 100
  },
  events,
  invariant
});
```

Use `test.create` to reuse the model-testing event executors and state
assertions. It creates a fresh session for every generated run and shrink
attempt, and always disposes it:

```ts
await propertyTest(createTestModel(machine), {
  events,
  test: {
    create: () => ({
      params: {
        events: { INC: ({ event }) => actor.send(event) },
        states: {
          active: (snapshot) => expect(renderedCount()).toBe(snapshot.context.count)
        }
      },
      dispose: () => actor.stop()
    })
  },
  invariant
});
```

<!-- propertyTest coverage fields from packages/core/src/graph/propertyCoverage.ts -->

Coverage reports stable state-node, configuration, event-type, transition,
guard, and frontier identifiers. Topology dimensions separate `covered`,
`uncovered`, `unreachable`, and `unknown`; transition hits come from selected
XState microsteps rather than inferred state visitation.

`coverage.eventCases` separately reports `generated`, `applicable`, `executed`,
and `ignored` counts for supplied cases. These counts do not imply payload-domain
coverage. Dynamic transition definitions count as hits, while
`coverage.dynamicTransitions` keeps their outcome completeness `unknown` and
lists only resolved targets actually observed.

`coverage.exploration` always reports configured, completed, and attempted
runs; configured and observed sequence lengths; frontier budgets; adapter
seeds/paths; and truncation. Coverage is relative to these supplied cases and
bounds, never a claim of global behavioral completeness.

Use `commands.advance` with a SUT adapter that owns its clock. The adapter
returns any events delivered by advancing time so XState can apply them through
the same pure transition path before comparing model and SUT snapshots.

```ts
await propertyTest(machine, {
  events: {},
  commands: { advance: fc.integer({ min: 0, max: 1_000 }) },
  sut: timerSut,
  invariant: ({ snapshot }) => {
    // Checked after every stable macrostep.
  }
});
```

Runtime command generators also support checkpoints and stopping:

```ts
commands: {
  advance: fc.nat({ max: 1_000 }),
  checkpoint: fc.record({ label: fc.string() }),
  stop: fc.constant({})
}
```

The neutral XState layer owns the chronological trace, portable replay fixture,
temporal checks, reference-oracle comparison, and SUT comparison. A reference
oracle supplies its own transition implementation:

```ts
await propertyTest(machine, {
  events,
  reference: {
    create: () => referenceSession,
    projectModel: (snapshot) => snapshot.context
  },
  temporal: [
    {
      type: 'eventually',
      id: 'settles',
      within: 10,
      predicate: ({ snapshot }) => snapshot.matches('settled')
    }
  ],
  invariant
});
```

### Temporal properties

Four temporal operators are available. Each one is checked on every stable
macrostep:

| `type` | Fails when |
| --- | --- |
| `always` | The `predicate` does not hold on some stable step. |
| `never` | The `predicate` holds on some stable step. |
| `eventually` | The `predicate` never holds. |
| `until` | `hold` stops holding before `until` holds. |

`always` and `never` take a single `predicate`. `eventually` takes a
`predicate`, and `until` takes both `hold` and `until` predicates.

`eventually` and `until` accept an optional `within` bound, measured in stable
steps:

- With `within`, the property fails as soon as that many stable steps elapse
  without being satisfied.
- If the run ends before the `within` bound is reached, the property is
  **inconclusive**, not failed. A run that is too short to decide a bounded
  property never reports a violation.
- Without `within`, the property must be satisfied before the run ends, and an
  unsatisfied property fails at `finish()`.

```ts
temporal: [
  {
    type: 'always',
    id: 'count-never-negative',
    predicate: ({ snapshot }) => snapshot.context.count >= 0
  },
  {
    type: 'never',
    id: 'no-error-state',
    predicate: ({ snapshot }) => snapshot.matches('error')
  },
  {
    // fails at step 10 if `settled` was not reached by then;
    // inconclusive if the run ends before step 10
    type: 'eventually',
    id: 'settles',
    within: 10,
    predicate: ({ snapshot }) => snapshot.matches('settled')
  },
  {
    // must be satisfied before the run ends
    type: 'until',
    id: 'stays-open-until-closed',
    hold: ({ snapshot }) => snapshot.matches('open'),
    until: ({ snapshot }) => snapshot.matches('closed')
  }
]
```

The optional `@xstate/test/effect-schema` entrypoint converts Effect
Schemas into FastCheck arbitraries without adding Effect to XState:

```ts
import * as Schema from 'effect/Schema';
import { fromEffectSchemas } from '@xstate/test/effect-schema';

const events = fromEffectSchemas({
  INC: Schema.Struct({ value: Schema.Number })
});
```

`fromEffectSchema(schema)` converts a single schema; `fromEffectSchemas(map)`
converts a keyed map of payload schemas for use as `events`.

## Deriving generators from schemas

`eventsFromSchemas(machine)` builds the `events` map from the event schemas
declared on the machine, so payload generators do not have to be written by
hand:

```ts
import * as z from 'zod';
import { createMachine } from 'xstate';
import { eventsFromSchemas, propertyTest } from '@xstate/test';

const machine = createMachine({
  schemas: {
    events: {
      INC: z.object({ value: z.number().int() }),
      RESET: z.object({})
    }
  }
  // ...
});

await propertyTest(machine, {
  events: eventsFromSchemas(machine),
  invariant: ({ snapshot }) => {
    expect(snapshot.context.count).toBeGreaterThanOrEqual(0);
  }
});
```

Generated payloads never include a `type` field; the event-map key supplies the
event type. A declared `type` field is stripped.

To override a derived generator, merge an explicit one over the derived map.
`mergeEventGenerators(derived, explicit)` does that, and explicit entries win:

```ts
events: mergeEventGenerators(eventsFromSchemas(machine), {
  INC: fc.record({ value: fc.integer({ min: 0, max: 10 }) })
});
```

`propertyTest()` derives the missing generators for you: every event type the
machine declares a runtime schema for and that `events` does not configure is
filled in from that schema. Pass `deriveEvents: false` to turn that off, or
call `eventsFromSchemas()` yourself when you want to inspect or post-process
the derived map. Type-only `types<...>()` declarations carry no runtime
structure, so implicit derivation skips them.

### Supported schema libraries

Generation requires a schema whose structure can be inspected:

| Library | Entrypoint | Notes |
| --- | --- | --- |
| Zod (v3 and v4) | `@xstate/test` | `object`, `string`, `number`, `int`, `bigint`, `boolean`, `date`, `literal`, `enum`, `union`, `array`, `tuple`, `record`, `optional`, `nullable`, `default`, `catch`, `readonly`, `null`, `undefined`, `any`, `unknown` |
| Effect Schema | `@xstate/test/effect-schema` | Import `eventsFromSchemas` from that entrypoint so Effect stays optional |

An unsupported schema kind throws an error naming the schema path, for example
`'SET.when'`.

Other Standard Schema implementations validate but expose no structure, so no
generator can be derived from them. Type-only declarations (`types<{...}>()`
and `types.events`) are erased at runtime and cannot be derived either. For
both cases, supply a generator explicitly, or pass a `fallback` converter:

```ts
eventsFromSchemas(machine, {
  fallback: (schema, path) => myConverter(schema)
});
```

### Events without a schema

Event types that appear in the machine's transitions but have no declared
schema are generated as `{}` by default. Pass `eventsWithoutSchema: 'skip'` to
leave them out of the map:

```ts
eventsFromSchemas(machine, { eventsWithoutSchema: 'skip' });
```

## Effects are not executed (`mode: 'pure'`)

By default `propertyTest()` drives the machine through the pure `transition()`
path. It never starts an actor, so no effect is executed. Set
[`mode: 'executed'`](#executed-mode) to run a real actor instead.

In pure mode:

- `invoke`, `spawn`, and enqueued actions are collected as executable action
  objects on each timeline entry's `effects` array, and on the
  `PropertyInvariantContext.effects` passed to `invariant` and temporal
  predicates. Assert on them; they do not run.
- Invoked actors never start, so their `onDone`, `onError`, and `onSnapshot`
  transitions are never taken by the property run itself. Deliver the
  corresponding events yourself from `events` if you want to explore those
  transitions.
- `after` delays and other timers are not driven by the property run. Time only
  moves through `commands.advance`, and only a SUT that owns its own clock can
  turn that into delivered events. `PropertySutSession.advance(milliseconds)`
  returns the events its clock delivered, and XState applies them through the
  same pure transition path before comparing model and SUT snapshots. Without a
  `sut`, an `advance` command records a runtime timeline entry and advances the
  stable step count, but delivers nothing.

Path generation (`getShortestPaths()`, `getSimplePaths()`, and the other
`TestModel` path methods) has the same limitation: paths are computed from pure
transitions, so transitions that depend on invoked actors or timers are not
discovered. Supply those events explicitly, or use `getPathsFromEvents()` with
an event sequence you control.

## Executed mode

`mode: 'executed'` runs the machine as a real actor instead of stepping it
through `transition()`. Invoked and spawned actors start, their `onDone`,
`onError`, and `onSnapshot` transitions fire, `raise` and `sendTo` are
delivered, and `after` transitions are reachable.

The actor runs on a `SimulatedClock`, so no delay elapses on its own. Time
moves only through generated `advance` commands, and no `sut` is required for
them:

```ts
await propertyTest(machine, {
  numRuns: 100,
  mode: 'executed',
  events: { START: fc.constant({}) },
  commands: { advance: fc.integer({ min: 100, max: 900 }) },
  invariant: ({ snapshot }) => {
    // ...
  }
});
```

After every event, `advance`, and `outcome` command, the runner drains pending
microtasks and macrotasks until the actor's inspection stream stops producing
events, then checks the invariant and temporal properties against the settled
snapshot.

### Steering invoked actors

Real services should not run inside a property campaign. Two options replace
them:

`actors` provides fixed logic for named invoke sources, through
`machine.provide({ actors })`:

```ts
await propertyTest(machine, {
  mode: 'executed',
  actors: {
    fetchUser: createAsyncLogic({ run: async () => ({ name: 'Ada' }) })
  },
  // ...
});
```

`outcomes` replaces a named source with a stub whose result the adapter
generates and shrinks, so a single campaign explores both the success and the
failure branch:

```ts
await propertyTest(machine, {
  mode: 'executed',
  outcomes: {
    fetchUser: fc.oneof(
      fc.record({ ok: fc.constant(true), output: fc.record({ id: fc.integer() }) }),
      fc.record({ ok: fc.constant(false), error: fc.constant('offline') })
    )
  },
  events: { FETCH: fc.constant({}) },
  invariant: () => {}
});
```

Each stub stays pending until an `outcome` command supplies its result, so the
generated ordering of events and outcomes is part of what the adapter shrinks.
A stub that never receives an outcome simply never resolves, and the run ends
with the machine still in its invoking state.

`actors` and `outcomes` are rejected in pure mode.

### What executed mode does and does not make deterministic

Determinism covers everything that goes through the actor system and the
simulated clock: delayed transitions, delayed sends, invoked and spawned actor
lifecycles, and the order in which their events reach the machine.

It does not cover anything outside that boundary. Real network calls, real
timers created outside the actor's clock, `Date.now()`, and `Math.random()` are
not intercepted. Replace the actors that reach for them with `actors` or
`outcomes`.

### Timeline entries

Executed runs add a third timeline entry kind, `'actorEvent'`, for every
transition the actor system performed on its own during a step: a child
actor's `onDone`/`onError`/`onSnapshot`, a delayed transition, or a relayed
send. Each entry carries the event, the actor that transitioned
(`source: 'root' | 'child'` and `actorId`), and the resulting snapshot.
Transitions on the tested actor are attributed to coverage exactly like
generated events; a child actor's own transitions are not, because coverage is
declared from the tested machine.

Two coverage details differ from pure mode:

- Guard coverage is attributed through the guarded transitions that were
  selected, because the inspection protocol reports the microsteps taken
  rather than every guard that was evaluated. `coverage.guardOutcomes` stays
  empty.
- Initial-transition and initial-guard coverage is computed from the pure
  initial transition, because the `@xstate.init` inspection event carries no
  microsteps. This covers registered transitions taken during initialization
  (such as `always` transitions); synthetic compound-state initial entry is
  excluded from both the transition universe and recorded transition counts.

`coverage.exploration.mode` reports `'pure'` or `'executed'`.

### Replaying an executed failure

A failure fixture from an executed run records `mode: 'executed'` and an
`outcomes` log: every invoked actor's resolved output or error, keyed by
invoke source and by how many actors of that source had already resolved.
`replayPropertyTest()` reads that log, replaces each recorded source with a
stub, and replays the recorded outcomes in order, so the failure reproduces
without calling any real service:

```ts
await replayPropertyTest(machine, fixture, {
  invariant: ({ snapshot }) => {
    // ...
  }
});
```

Pass `mode: 'pure'` to replay the fixture's events through the pure path
instead, or `actors` to replay against different logic.

## Choosing between path testing and property testing

Both APIs live in `xstate/graph`, are re-exported from `@xstate/test`, and
share `TestModel`.

| | Path testing | Property testing |
| --- | --- | --- |
| API | `model.getShortestPaths()` / `getSimplePaths()` + `path.test(params)`, or `model.testPath(path, params)` | `propertyTest(machineOrModel, options)` |
| Coverage strategy | Exhaustive traversal of the reachable graph, up to the traversal limits | Randomized command sequences from the generators you supply |
| Event payloads | Fixed, from `events` traversal options | Generated per run, and shrunk on failure |
| Failure output | The failing path | A shrunk counterexample, a chronological trace, and a portable replay fixture |

Use path testing when you want deterministic, enumerable coverage of a finite
graph and you can fix event payloads. Use property testing when payloads,
ordering, or timing matter, or when you compare the machine against a reference
implementation or a real system under test.

## Writing an adapter

`propertyTest()` here has the fast-check adapter built in, but the layer
underneath it is generator-neutral: `propertyTest()` from `xstate/graph` takes
an `adapter`, and `@xstate/test` supplies `fastCheckAdapter()` as one. Pass
`adapter` to override the implicit one.

An adapter connects a generator engine to the neutral XState layer. It
implements `PropertyTestAdapter<TKind>`, where `TKind` is a
`PropertyGeneratorKind` — a higher-kinded type that tells `propertyTest()` what
a generator of a given payload type looks like in your engine:

```ts
interface FastCheckGeneratorKind extends PropertyGeneratorKind {
  readonly generator: fc.Arbitrary<this['target']>;
}
```

With that declaration, `events.INC` must be an `fc.Arbitrary` of the `INC`
payload, `commands.advance` an `fc.Arbitrary<number>`, and so on.

`run(request)` receives a `PropertyTestAdapterRequest`:

| Field | Description |
| --- | --- |
| `events` | One entry per declared event case: `{ type, caseId, generator }`. `generator` is the opaque value you supplied in `events`. |
| `commands` | One entry per configured runtime command: `{ type: 'advance' \| 'checkpoint' \| 'stop', generator }`. |
| `runBudget` | The number of runs this scenario should use, when `frontiers.runsPerFrontier` or a batched campaign fixes it. Prefer it over your own run count. |
| `runOffset` | Runs already completed by earlier batches of the same campaign. Offset a fixed seed by it so each batch explores different sequences. |
| `createEvent(type, payload)` | Builds a typed event from a generated payload. Use it if your engine produces concrete events instead of driving the runner. |
| `createRunner()` | Creates a fresh `PropertyScenarioRunner` for one run or shrink attempt. |

Each run follows the same lifecycle:

1. `createRunner()`, then `await runner.start()`.
2. For each generated step, either an event — `runner.canRunGenerated(type,
   generated, caseId)` to check applicability, then
   `await runner.runGenerated(type, generated, caseId)` — or a runtime command
   — `runner.canRunCommand(applicable)`, then `await runner.advance(ms)`,
   `await runner.checkpoint(label)`, or `await runner.stop()`.
3. `runner.finish()` to settle pending temporal properties.
4. `await runner.dispose()` in a `finally` block, always.

`run()` resolves with a `PropertyTestAdapterResult`: `runs` (runs actually
executed), `exploration` (`configuredRuns`, `maximumSequenceLength`, and
optional `engine`, `seed`, `path`, `truncated`, `truncationReasons`), `error`
(the failure to report, omitted on success), and `replay` (engine-native
metadata attached to `PropertyTestFailure.replay`).

```ts
import type {
  PropertyGeneratorKind,
  PropertyTestAdapter,
  PropertyTestAdapterRequest,
  PropertyTestAdapterResult
} from '@xstate/test';
import type { EventObject, Snapshot } from 'xstate';

interface RandomKind extends PropertyGeneratorKind {
  readonly generator: () => this['target'];
}

export function randomAdapter(numRuns = 100): PropertyTestAdapter<RandomKind> {
  return {
    async run<TSnapshot extends Snapshot<unknown>, TEvent extends EventObject>(
      request: PropertyTestAdapterRequest<TSnapshot, TEvent>
    ): Promise<PropertyTestAdapterResult> {
      const runs = request.runBudget ?? numRuns;
      for (let run = 0; run < runs; run++) {
        const runner = request.createRunner();
        try {
          await runner.start();
          for (let step = 0; step < 10; step++) {
            const { type, caseId, generator } =
              request.events[Math.floor(Math.random() * request.events.length)];
            const generated = (generator as () => unknown)();
            if (!runner.canRunGenerated(type, generated, caseId)) continue;
            await runner.runGenerated(type, generated, caseId);
          }
          runner.finish();
        } catch (error) {
          return {
            runs: run + 1,
            exploration: { configuredRuns: runs, maximumSequenceLength: 10 },
            error
          };
        } finally {
          await runner.dispose();
        }
      }
      return {
        runs,
        exploration: { configuredRuns: runs, maximumSequenceLength: 10 }
      };
    }
  };
}
```

This adapter does not shrink. Shrinking is a property of the generator engine:
`fastCheckAdapter()` gets it from `fc.commands()`, which shrinks both the
command sequence and each generated payload.

Generated payloads must be plain objects. If a generator produces a primitive,
an array, or `null`, the run fails with an error naming the offending event
case and pointing at `resolve`.

## Failures, traces, and replay

A failing property throws `PropertyTestFailure`, with:

| Field | Description |
| --- | --- |
| `trace` | The chronological `PropertyTrace`: `start`, `initialSnapshot`, `timeline`, `prefixEvents`, `events`, `commands`, `steps`, `finalSnapshot`, and observations. |
| `cause` | The original error thrown by the invariant, temporal check, comparison, or SUT. |
| `replay` | Engine-native metadata (`engine`, `engineVersion`, `seed`, `path`, `replayPath`, `data`) for re-running the same engine. |
| `fixture` | A `PortablePropertyReplayFixture` (`formatVersion: 2`) that replays without the generator engine. |
| `coverage` | The `PropertyCoverage` accumulated up to the failure. |
| `summary` | The short message, without the trace. |

`message` is the summary followed by `formatPropertyTrace(trace)`, and it is
built before the stack is captured, so reporters that print only `error.stack`
still show the counterexample.

`formatPropertyTrace(trace)` returns a human-readable string.
`serializePropertyTrace(trace)` returns a JSON-safe object — snapshots are
converted with `toJSON()` where available — for writing traces to disk or
attaching them to CI artifacts.

`replayPropertyTest(machineOrModel, fixture, options)` replays a fixture. It
takes `invariant`, and optional `temporal`, `reference`, `sut`, `test`,
`restoreSnapshot`, and `expect`. A fixture recorded from a snapshot start
requires `restoreSnapshot`. The fixture's recorded machine `id` and `version`
are checked against the machine you pass.

`expect` says what the replay is for:

| Value | Behavior |
| --- | --- |
| `'failure'` (default) | Stops at the recorded `failedAt` step and throws the reproduced failure. When the failure does not reproduce, it throws `PropertyReplayNotReproducedError`, whose `step` is the recorded failing step. |
| `'pass'` | Replays the whole timeline and resolves with the `PropertyTrace`. Any property failure is thrown as-is. |

`failedAt` is absent on fixtures recorded from a passing run, such as the ones
an offline suite is built from; those are replayed with `expect: 'pass'`.

```ts
import { PropertyReplayNotReproducedError, replayPropertyTest } from '@xstate/test';

try {
  await replayPropertyTest(machine, fixture, { invariant });
} catch (error) {
  if (error instanceof PropertyReplayNotReproducedError) {
    // The regression is fixed: the fixture no longer reproduces its failure.
  }
}
```

A fixture records clock-delivered events twice: on the `advance` command, as
`deliveredEvents`, and as the `event` entries that follow it, each marked
`origin: 'clock'`. The replay of an `advance` command only re-records the
command — in pure mode there is no clock to run — so the events themselves are
replayed from those following entries. `replayPropertyTest()` checks the two
against each other before replaying and rejects a fixture whose clock-delivered
events were dropped or reordered.

`defaultEquivalent(left, right)` is the structural, key-order insensitive,
cycle-safe deep equality used to compare model projections against reference
and SUT observations. Use it to build a custom `equivalent` on top of the
default behavior.

`extractReplayPath(counterexample)` (exported from `@xstate/test`) pulls
the `replayPath` out of a raw fast-check `fc.commands` counterexample. You only
need it when you call fast-check yourself; `fastCheckAdapter()` already puts the
value on `PropertyTestFailure.replay.replayPath`.

## Starting from a snapshot or input

`options.input` supplies the machine input for the initial transition of every
run.

`options.start` starts every run from an existing snapshot instead. Both fields
are required:

```ts
await propertyTest(machine, {
  start: {
    snapshot: persistedSnapshot,
    serializeSnapshot: (snapshot) => snapshot.toJSON()
  },
  events,
  invariant
});
```

`serializeSnapshot` is what gets recorded in the replay fixture, so replaying
that fixture needs a matching `restoreSnapshot`:

```ts
await replayPropertyTest(machine, failure.fixture!, {
  invariant,
  restoreSnapshot: (snapshot) =>
    machine.resolveState(snapshot as { value: string; context: Context })
});
```

## Coverage reports

`propertyTest()` resolves with a `coverage` object. `xstate` exports formatters
that turn it into readable output and CI artifacts:

```ts
import {
  assertPropertyCoverage,
  formatPropertyCoverage,
  formatPropertyCoverageHTML,
  formatPropertyCoverageJUnit,
  propertyCoverageToJSON
} from '@xstate/test';

const { coverage } = await propertyTest(machine, {
  events,
  invariant
});

console.log(formatPropertyCoverage(coverage));
console.log(formatPropertyCoverage(coverage, { format: 'markdown' }));
```

`formatPropertyCoverage()` prints one line per dimension, for example
`transitions: 7/9 covered (77.8%), 1 uncovered, 1 unreachable, 0 unknown`,
followed by the outstanding ids, guard outcomes, event-case lifecycle counts,
temporal results and the exploration bounds. `format: 'markdown'` renders the
same data as tables. Output is deterministic, so it can be snapshot-tested.

- `propertyCoverageToJSON(coverage)` returns stable, JSON-safe data tagged with
  `formatVersion: 1`, for storing or diffing coverage between runs.
- `formatPropertyCoverageJUnit(coverage, { suiteName })` returns JUnit XML with
  one `<testcase>` per transition and per state node: `<failure>` for uncovered
  items and `<skipped>` for unreachable or unknown ones.
- `formatPropertyCoverageHTML(coverage, { title })` returns a single
  self-contained HTML document with summary cards and tables.

`assertPropertyCoverage()` gates a test on covered ratios
(`covered / (covered + uncovered)`), throwing an error with the formatted report
when a dimension falls short:

```ts
assertPropertyCoverage(coverage, { transitions: 1, stateNodes: 0.9 });
```

## Transition pairs and requirements

Two further coverage dimensions come from the machine definition itself.

`coverage.transitionPairs` tracks pairs of transitions that ran back to back
within a single run, keyed as `"<first id> -> <second id>"`. Chains are reset
between runs, so a pair is only covered when one run executed both transitions
in sequence. The universe of possible pairs is derived from the machine: a pair
is possible when the second transition's source node lies within the
configuration the first transition can leave behind. Pairs that involve a
dynamic (function) target are reported as `unknown`, since their targets are
only known at runtime. Large machines have quadratically many pairs, so
enumeration stops at 5,000 declared pairs and sets `transitionPairs.truncated`
to `true`; pairs observed at runtime are still reported as covered.

`coverage.requirements` tracks requirement ids declared through `meta`, on
state nodes and on transitions. A requirement is covered when any state node or
transition carrying it is covered.

```ts
const machine = createMachine({
  initial: 'idle',
  states: {
    idle: {
      meta: { requirements: 'REQ-1' },
      on: {
        SUBMIT: { target: 'sent', meta: { requirements: ['REQ-2', 'REQ-3'] } }
      }
    },
    sent: {}
  }
});

const { coverage } = await propertyTest(machine, {
  events: { SUBMIT: fc.constant({}) },
  invariant: () => {}
});

coverage.requirements.uncovered; // requirement ids never exercised
coverage.requirements.sources['REQ-2']; // ['transition:…'] — where it is declared
```

`meta.requirements` accepts a string or an array of strings.

## Weighting events

Every event case and command is generated with equal probability by default.
Give a case a `weight` to change how often it is drawn relative to the others:

```ts
await propertyTest(machine, {
  events: {
    // Drawn roughly ten times as often as RESET.
    INC: { generate: fc.record({ value: fc.integer() }), weight: 10 },
    RESET: { generate: fc.constant({}), weight: 1 }
  },
  commands: {
    // Rarely stop the actor mid-run.
    stop: { generate: fc.constant({}), weight: 0.1 }
  },
  invariant
});
```

Weights must be positive, finite numbers and default to `1`. They are relative,
not probabilities, and may be fractional. A bare generator is equivalent to
`{ generate, weight: 1 }`; the `weight` key is what distinguishes the descriptor
form for `commands`. When every weight is `1` the generation path is unchanged,
so existing seeds keep reproducing the same sequences.

The effective weight of each case is reported in
`coverage.eventCases[id].weight`.

## Stop conditions

`until` stops a campaign as soon as the accumulated coverage is good enough.
The adapter is invoked in batches of `batchRuns` runs (default `25`), and the
condition is re-evaluated between batches:

```ts
const { coverage } = await propertyTest(machine, {
  maxCommands: 6,
  events: { NEXT: fc.constant({}) },
  invariant,
  until: { transitions: 1, eventCases: 1 },
  batchRuns: 25,
  maxRuns: 500
});

coverage.exploration.stoppedBecause; // 'until' | 'budget' | 'failure'
```

The object form accepts the ratios `stateNodes`, `transitions`,
`transitionPairs`, `guards`, `eventCases`, and `requirements`, plus `runs` and
`timeMs`. A ratio is `covered / (covered + uncovered)`; `eventCases` is the
share of event cases executed at least once. Every listed key must hold. `any`
holds when at least one of the conditions it lists holds:

```ts
until: { any: [{ transitions: 1 }, { timeMs: 5_000 }] };
```

The predicate form receives the aggregated coverage:

```ts
until: (coverage) => coverage.stateNodes.uncovered.length === 0;
```

A batched campaign completes at most `maxRuns` runs (default `100`), which is
reported as `coverage.exploration.configuredRuns`. Without `until` (and without
`frontiers: 'auto'`) the adapter is invoked exactly once with its own
`numRuns`, unchanged.

## Coverage-guided exploration

`frontiers: 'auto'` spends each batch where coverage is missing. Between
batches it maps the uncovered transitions to the state nodes that declare them,
finds the shortest path from the initial state to each of those state nodes,
and replays those paths as the prefixes of the next batch:

```ts
const { coverage } = await propertyTest(machine, {
  maxCommands: 4,
  events: { GO: fc.constant({}), FINISH: fc.constant({}) },
  invariant,
  frontiers: 'auto',
  until: { transitions: 1 },
  maxRuns: 200
});
```

The expanded form is `{ strategy: 'uncovered', maxFrontiers, runsPerFrontier,
limit }`. `maxFrontiers` (default `5`) bounds the frontiers explored per batch,
`runsPerFrontier` defaults to an even split of the batch, and `limit` (default
`1000`) bounds the path search. Frontiers are ordered by how many uncovered
transitions their state node owns and deduplicated by target configuration.
When nothing uncovered is reachable — or the machine cannot be traversed within
`limit` — the batch falls back to unguided random exploration.

A frontier prefix is replayed verbatim: shrinking only shortens the generated
continuation, so a counterexample keeps the path that reached the interesting
state. Each frontier is reported in `coverage.frontiers` and
`coverage.exploration.frontiers`.

## Swarm testing

`swarm` restricts each run to a seeded random subset of the declared event
cases, so rare interleavings are not crowded out by the most common events.
Cases left out of a run report themselves as inapplicable for that run.

```ts
const { coverage } = await propertyTest(machine, {
  numRuns: 200,
  maxCommands: 8,
  events: { OPEN: fc.constant({}), CLOSE: fc.constant({}), LOCK: fc.constant({}) },
  invariant,
  swarm: true
});

coverage.exploration.swarm; // { runs, averageEnabled }
```

`true` is `{ minCases: Math.ceil(cases / 2) }`. The expanded form takes
`minCases` (the fewest cases a run may enable) and `seed` (the campaign seed the
per-run subsets are derived from, default `0`). The subset for a run is a pure
function of that seed and the run index, so a campaign's swarm sets are
reproducible; the enabled case ids are recorded on the run's `PropertyTrace` and
on any replay fixture as `swarm`.

Shrinking is unaffected: as soon as a run fails, the enabled subset is frozen to
the failing run's, so every shrink attempt explores the same case set.

Full event-case coverage is unreachable while `swarm` is on when a case is never
enabled, so a stop condition such as `until: { eventCases: 1 }` may never hold.
Bound such campaigns with `maxRuns`, or drop `eventCases` from `until`.

## Targeted search

`target(observation, label?)` is available anywhere `label()` is, and
`options.target` is the shorthand for calling it on every stable step. The
campaign keeps the best (highest) observed value and reports it as
`coverage.exploration.target`:

```ts
coverage.exploration.target; // { best, label, improvements }
```

`frontiers: { strategy: 'target' }` turns those observations into a hill climb.
Between batches, the prefixes that reached the best values are replayed as the
frontiers of the next batch, and the adapter generates a random continuation
from each — so a value that needs more events than `maxCommands` allows in a
single run is still reachable:

```ts
const { coverage } = await propertyTest(counterMachine, {
  maxCommands: 6,
  events: { INC: fc.constant({}), DEC: fc.constant({}) },
  invariant,
  target: ({ snapshot }) => snapshot.context.count,
  frontiers: { strategy: 'target' },
  until: (coverage) => coverage.exploration.target.best >= 8,
  batchRuns: 10,
  maxRuns: 200
});
```

The expanded form takes `maxFrontiers` (best prefixes carried into the next
batch, default `5`) and `runsPerFrontier` (default: an even split of the batch).
Until an observation is recorded, batches explore randomly.

## Labels and statistics

`label(name, value?)` and `classify(condition, name)` are available on the
invariant, temporal, SUT, and reference contexts. Use them to measure what the
generated sequences actually did:

```ts
const { coverage } = await propertyTest(machine, {
  numRuns: 200,
  events: { WITHDRAW: fc.record({ amount: fc.integer({ min: 1 }) }) },
  invariant: ({ snapshot, label, classify }) => {
    label('balance', snapshot.context.balance);
    classify(snapshot.context.balance === 0, 'emptied');
  },
  expectLabels: { emptied: { min: 0.1 } }
});

coverage.labels.emptied.count; // total occurrences
coverage.labels.emptied.share; // runs that recorded it / attempted runs (0..1)
coverage.labels.balance.values['0']; // occurrences per recorded value
```

`expectLabels` fails the campaign when a label is too rare. `min` is a share of
attempted runs (`0`..`1`, capped at `1`) and `minCount` is a total number of occurrences. A
shortfall throws an error naming every label that fell short, with the
`PropertyCoverage` attached as `error.coverage`.

Labels are rendered by `formatPropertyCoverage()` in both text and markdown,
and by `propertyCoverageToJSON()`. Counts include shrinking runs, so treat them
as a distribution sketch rather than an exact tally.

## Offline suites

A property suite is a deterministic set of replay fixtures recorded from a
passing campaign. Commit it and replay it in CI without the generator adapter —
and therefore without `fast-check` — installed.

Traces are collected through `collect`, the per-run hook `propertyTest()` calls
after each run finishes and its runner is disposed:

```ts
await propertyTest(machine, {
  numRuns: 50,
  events,
  invariant,
  collect: (trace, { passed, runIndex }) => {
    if (passed) {
      recorded.push(trace);
    }
  }
});
```

`passed` is `false` when the run ended in a property failure, and `runIndex`
counts runner creations, shrink attempts included.

```ts
import {
  generatePropertySuite,
  serializePropertySuite
} from '@xstate/test';

const suite = await generatePropertySuite(machine, {
  numRuns: 200,
  events,
  invariant
});

await writeFile('suite.json', serializePropertySuite(suite));
```

`generatePropertySuite(machineOrModel, options)` takes every `propertyTest()`
option plus:

| Option | Description |
| --- | --- |
| `select` | `'minimal'` (default) keeps the smallest greedy subset of recorded traces that preserves the campaign's covered set. `'all'` keeps every distinct trace. |
| `maxFixtures` | Upper bound on the number of fixtures kept. |
| `generatedAt` | Recorded verbatim as `suite.generatedAt`. Omit it to keep the suite byte-stable across regenerations. |

Selection runs a greedy set cover over the transition ids, state node ids, and
guard ids each trace exercised, after dropping traces with identical command
sequences. Ties are broken by the shorter trace, then by a stable key, so the
same campaign always produces the same suite.

The suite is `{ formatVersion: 1, machineId, machineVersion, generatedAt,
fixtures, coverage }`, where `fixtures` are `PortablePropertyReplayFixture`
values and `coverage` is the `propertyCoverageToJSON()` snapshot of the whole
campaign — not only of the selected fixtures. `serializePropertySuite(suite)`
and `parsePropertySuite(json)` round-trip it; parsing rejects unknown format
versions.

Replaying the suite needs only `xstate/graph`, so a committed suite runs in CI
without fast-check installed:

```ts
import { parsePropertySuite, replayPropertySuite } from '@xstate/test';

const suite = parsePropertySuite(await readFile('suite.json', 'utf8'));
const { passed, failed } = await replayPropertySuite(machine, suite, {
  invariant
});

if (failed.length) {
  throw new Error(failed.map((failure) => failure.title).join('\n'));
}
```

Every fixture is expected to pass — a suite is a regression set, not a set of
counterexamples. `replayPropertySuite()` resolves with `{ passed, failed }`,
where each failure carries `fixture`, `index`, `title`, and `error`.

To register one test case per fixture instead, use `describePropertySuite()`.
It is framework-agnostic: pass `it` and `describe`, or let it use the ambient
globals of Vitest or Jest.

```ts
describePropertySuite(suite, machine, { invariant });
```

`replayPropertySuiteFixture(machineOrModel, fixture, options)` replays a single
fixture and rejects with the underlying failure when it no longer passes. It is
`replayPropertyTest()` with `expect: 'pass'`.

## Playwright

`@xstate/test/playwright` drives a Playwright page as the system under test. It
turns a `Page` and a small configuration into the `sut` or `test` option that
`propertyTest()` expects.

`@playwright/test` (or `playwright`, version 1.40 or later) is an optional peer
dependency. The entrypoint never imports it: it accepts any object that
structurally matches the parts of `Page` it uses, so a real `Page` is
assignable without extra typing.

[`examples/property-testing-playwright`](../../examples/property-testing-playwright)
is a runnable version.


### Style 1: `createPlaywrightSut`

`createPlaywrightSut(page, config)` returns a `PropertySut`. The runner projects
both the model snapshot and the DOM to comparable values and fails the run when
they diverge.

```ts
import { test } from '@playwright/test';
import * as fc from 'fast-check';
import { formatPropertyCoverage, propertyTest } from '@xstate/test';
import { createPlaywrightSut } from '@xstate/test/playwright';
import { formMachine } from './machine';

test('the form matches the model', async ({ page }) => {
  const { coverage } = await propertyTest(formMachine, {
    numRuns: 25,
    maxCommands: 8,
    events: {
      NEXT: fc.constant({}),
      BACK: fc.constant({}),
      EDIT: fc.record({ value: fc.string() })
    },
    sut: createPlaywrightSut(page, {
      reset: async (page) => {
        await page.goto('/form.html');
      },
      events: {
        NEXT: (page) => page.click('#next'),
        BACK: (page) => page.click('#back'),
        EDIT: (page, event) => page.fill('#field', event.value)
      },
      read: async (page) => ({
        step: await page.locator('#step').textContent(),
        error: await page.locator('#error').textContent()
      }),
      projectModel: (snapshot) => ({
        step: snapshot.value,
        error: snapshot.context.error
      })
    }),
    invariant: () => {}
  });

  console.log(formatPropertyCoverage(coverage));
});
```

#### Configuration

| Option          | Default                                       | Purpose                                              |
| --------------- | --------------------------------------------- | ---------------------------------------------------- |
| `events`        | required                                      | Performs each generated event against the page.      |
| `read`          | required                                      | Projects the DOM to a model-comparable value.        |
| `projectModel`  | required                                      | Projects the model snapshot to the same shape.       |
| `projectSut`    | identity                                      | Normalizes the value from `read` before comparison.  |
| `equivalent`    | deep equality                                 | Compares the two projections.                        |
| `settle`        | `page.waitForLoadState('networkidle')`        | Waits for quiescence before every comparison.        |
| `advance`       | `page.clock.runFor(ms)`                       | Advances page time for `advance` commands.           |
| `checkpoint`    | screenshot into `screenshotDir`               | Records a checkpoint.                                |
| `screenshotDir` | `property-screenshots`                        | Directory for default checkpoint screenshots.        |
| `reset`         | none                                          | Runs once when a scenario session is created.        |
| `stop`          | none                                          | Runs when a scenario stops.                          |
| `dispose`       | none                                          | Runs when a scenario session is disposed.            |
| `mocks`         | none                                          | Per-case `page.route()` setup, applied before events, keyed by `"<type>.<case>"` or `"<case>"`. |
| `caseOf`        | `event.case ?? event.type`                    | Resolves the mock case for an event.                 |

Every scenario run creates a new session, so put navigation or app state reset
in `reset`. Without it, state left over from the previous run diverges from the
freshly started model.

### Style 2: `createPlaywrightTestModelSession`

If you prefer assertions over projections, `createPlaywrightTestModelSession`
adapts the `TestParam` style (`events` executors and `states` assertions) to the
`test` option:

```ts
await propertyTest(formMachine, {
  numRuns: 25,
  events: { NEXT: fc.constant({}), BACK: fc.constant({}) },
  test: createPlaywrightTestModelSession(page, {
    reset: (page) => page.goto('/form.html'),
    events: {
      NEXT: (page, step) => page.click('#next'),
      BACK: (page) => page.click('#back')
    },
    states: {
      review: async (page, snapshot) => {
        await expect(page.locator('#summary')).toHaveText(
          snapshot.context.name
        );
      },
      '*': async (page, snapshot) => {
        await expect(page.locator('#step')).toHaveText(String(snapshot.value));
      }
    }
  }),
  invariant: () => {}
});
```

`states` keys are matched against the model state; `'*'` runs for every state
that no other key matched. The `events` executors receive the `Step`, so
`step.event` carries the generated payload.

Both styles can be combined with `sut` and `test` in the same `propertyTest()`
call when you want projection-based comparison and page assertions together.

### Mocks per case

`mocks` keys are event cases, not just event types, so the same event can be
steered down a success path or a failure path depending on which case the
generator picked:

```ts
propertyTest(machine, {
  events: {
    SUBMIT: [
      { case: 'ok', generate: fc.constant({}) },
      { case: 'error', generate: fc.constant({}) }
    ]
  },
  sut: createPlaywrightSut(page, {
    events: {
      SUBMIT: (page) => page.click('#submit')
    },
    mocks: {
      'SUBMIT.ok': (page) =>
        page.route('**/api/submit', (route) =>
          route.fulfill({ status: 200, body: '{"ok":true}' })
        ),
      'SUBMIT.error': (page) =>
        page.route('**/api/submit', (route) => route.fulfill({ status: 500 }))
    },
    read,
    projectModel
  }),
  invariant
});
```

For a generated event the key is looked up as `"<type>.<case>"` first and then
as `"<case>"`, where `<case>` is the `case` configured on the event (`'default'`
when none is configured). Events the generator did not produce — prefix, clock
and replayed events — have no case, and fall back to the key returned by
`caseOf`, which defaults to `event.case ?? event.type`:

```ts
createPlaywrightSut(page, {
  mocks: {
    'SUBMIT.error': (page) => page.route(/* ... */)
  },
  caseOf: (event) => `${event.type}.${event.outcome}`,
  read,
  projectModel
});
```

The mock runs before the event action, and only when the resolved case differs
from the previously applied one, so repeated events do not stack routes. Every
route a mock installs is removed with `page.unroute()` when the scenario session
is disposed, so handlers do not accumulate across runs. Mock callbacks may
return the promise from `page.route()` directly, including Playwright versions
that resolve it to a disposable registration.

### Clock

`advance` commands call `page.clock.runFor(milliseconds)` by default. Install
the clock before navigating for it to have any effect:

```ts
await page.clock.install();
await page.goto('/form.html');
```

Supply your own `advance` when the page needs more than a clock tick, for
example to also drain a queue and report the events that fired:

```ts
advance: async (page, ms) => {
  await page.clock.runFor(ms);
  return [{ type: 'TIMEOUT' }];
};
```

Returned events are fed back into the model, so return them only for timers that
the model also models.

### Screenshots

`checkpoint` commands write `‹screenshotDir›/‹label›.png`, with the label
sanitized for the filesystem and a `checkpoint-‹n›` fallback when the generator
did not supply one. Override `checkpoint` to trace something else, such as
appending the accessibility tree to a log.

### Failure output

A divergence throws a `PropertyTestFailure` with the message
`Property observation diverged`. The error carries the shrunk trace:

- `failure.trace.steps` — every event, with its phase and payload; the last
  entry names the step that broke.
- `failure.trace.finalObservation.sut` — `{ model, observed }`, the two
  projections that failed to match.
- `failure.replay` and `failure.fixture` — replay the counterexample with
  `replayPropertyTest()`.
- `failure.coverage` — the coverage collected up to the failure, printable with
  `formatPropertyCoverage()`.

## Concurrency

A sequential property run sends one event at a time and reads the system under
test between events, so it never observes a race. Two tools cover concurrency:
a scheduler that explores promise resolution orders within a normal run, and a
linearizability checker for histories of genuinely overlapping operations.

### Scheduling promise resolution order

`scheduler: true` adds an `fc.scheduler()` to the generated values of every run.
Wrap the system under test with `withScheduledSut` (and a reference oracle with
`withScheduledReference`) so its `send`, `read`, `settle`, and `advance` calls
resolve in an order the scheduler chooses instead of plain microtask order:

```ts
import {
  getCurrentScheduler,
  propertyTest,
  withScheduledSut
} from '@xstate/test';

await propertyTest(counterMachine, {
  numRuns: 100,
  scheduler: true,
  events: { INC: fc.constant({}) },
  sut: withScheduledSut({
    create: () => {
      // schedule the SUT's own background work on the same scheduler
      const scheduler = getCurrentScheduler();
      let committed = 0;
      let pending = 0;
      return {
        send: () => {
          const next = ++pending;
          void scheduler!.schedule(Promise.resolve(), 'commit').then(() => {
            committed = next;
          });
        },
        read: () => committed
      };
    },
    projectModel: (snapshot) => snapshot.context.count
  }),
  invariant
});
```

`getCurrentScheduler()` returns the run's scheduler while a run is in flight and
`undefined` otherwise, which is how the wrapper stays inert when the option is
off.

The ordering a failing run took is recorded on the replay metadata as
`replay.data.scheduler`: `tasks` (each task's id, label, scheduling type, and
status) and `ordering` (the task ids in release order). Feed `ordering` to
`fc.schedulerFor(ordering)` to rebuild the same scheduler by hand.

Limits:

- The commands themselves are not scheduled. `fc.scheduledModelRun` wraps every
  command in `scheduler.scheduleSequence`, and a sequence item blocks the
  scheduler until it settles, so a command awaiting a scheduled SUT call
  deadlocks. The adapter drives the whole run with `scheduler.waitFor` instead,
  which schedules the SUT's async boundaries but keeps commands sequential.
- Only work that goes through the scheduler is reordered. Timers, real I/O, and
  promises the SUT creates without `getCurrentScheduler()` resolve as usual.
- Replaying from `replay.data.scheduler` is manual: the seed and `replayPath`
  reproduce the command sequence, and `fc.schedulerFor(ordering)` reproduces the
  ordering.

### Linearizability

`checkLinearizable(history, model)` decides whether a
history of overlapping operations could have come from some sequential order of
those operations. Each entry carries the event that was sent, the response the
system gave, and the interval the operation was in flight:

```ts
import { checkLinearizable } from '@xstate/test';

const result = checkLinearizable(
  [
    { id: 'a', invocation: { type: 'write', value: 1 }, response: undefined, start: 0, end: 4 },
    { id: 'b', invocation: { type: 'read' }, response: 1, start: 1, end: 5 }
  ],
  {
    initial: 0,
    apply: (state, event) =>
      event.type === 'write'
        ? { state: event.value, response: undefined }
        : { state, response: state }
  }
);

result.linearizable; // true
result.witness; // the sequential order that explains the history
result.explored; // candidate steps examined
result.truncated; // the search hit `maxExplored` before deciding
```

The search is depth-first over the operations that could be linearized next —
those starting no later than the earliest end time still outstanding — with
`(state, completed set)` memoization. `truncated: true` means "not proven", not
"proven wrong": raise `maxExplored` (default `100000`) or shorten the history.

### Parallel commands

`runParallelPropertyCommands(machine, options)` is the QuickCheck State Machine
`parallel_commands` analogue: a sequential prefix puts the system in an
interesting state, then N branches race, and the resulting history is checked
against the machine's own pure `transition()` as the sequential specification.

```ts
import { runParallelPropertyCommands } from '@xstate/test';

const result = await runParallelPropertyCommands(counterMachine, {
  prefix: [{ type: 'INC' }],
  branches: [
    [{ type: 'INC' }, { type: 'INC' }],
    [{ type: 'INC' }]
  ],
  sut: {
    create: () => {
      let count = 0;
      return { send: async () => ++count };
    },
    projectModel: (snapshot) => snapshot.context.count
  }
});

result.linearizable;
result.history; // the recorded operations with their intervals
```

`send` may return the response directly; when it returns `undefined` the
response is read back with `read()`, so a `PropertySut` works unchanged.
Responses are compared against `projectModel(snapshot)` of the model state after
the event. Pass `maxExplored` to bound the search and `equalResponse` to replace
the structural comparison.
