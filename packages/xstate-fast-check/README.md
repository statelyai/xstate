# `@xstate/fast-check`

FastCheck adapter for generator-neutral XState property testing.

## Installation

`@xstate/fast-check` has `xstate` and `fast-check` as required peer
dependencies:

```bash
pnpm add -D @xstate/fast-check fast-check xstate
```

`effect` is an optional peer dependency. Install it only if you use the
`@xstate/fast-check/effect-schema` entrypoint:

```bash
pnpm add -D effect
```

## API

<!-- public exports from src/index.ts -->

Use `fastCheckAdapter()` with `propertyTest()` from `xstate/graph`:

```ts
import * as fc from 'fast-check';
import { propertyTest } from 'xstate/graph';
import { fastCheckAdapter } from '@xstate/fast-check';

await propertyTest(machine, {
  adapter: fastCheckAdapter({ seed: 42, numRuns: 1_000 }),
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
  adapter: fastCheckAdapter({ maxCommands: 20 }),
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
  adapter: fastCheckAdapter(),
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
  adapter: fastCheckAdapter(),
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
  adapter: fastCheckAdapter(),
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

The optional `@xstate/fast-check/effect-schema` entrypoint converts Effect
Schemas into FastCheck arbitraries without adding Effect to XState:

```ts
import * as Schema from 'effect/Schema';
import { fromEffectSchemas } from '@xstate/fast-check/effect-schema';

const events = fromEffectSchemas({
  INC: Schema.Struct({ value: Schema.Number })
});
```

`fromEffectSchema(schema)` converts a single schema; `fromEffectSchemas(map)`
converts a keyed map of payload schemas for use as `events`.

## Effects are not executed

`propertyTest()` drives the machine through the pure `transition()` path. It
never starts an actor, so no effect is executed:

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

## Choosing between path testing and property testing

Both APIs live in `xstate/graph` and share `TestModel`.

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
| `runBudget` | The number of runs this scenario should use, when `frontiers.runsPerFrontier` fixes it. Prefer it over your own run count. |
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
} from 'xstate/graph';
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

`formatPropertyTrace(trace)` returns a human-readable string.
`serializePropertyTrace(trace)` returns a JSON-safe object — snapshots are
converted with `toJSON()` where available — for writing traces to disk or
attaching them to CI artifacts.

`replayPropertyTest(machineOrModel, fixture, options)` replays a fixture. It
takes `invariant`, and optional `temporal`, `reference`, `sut`, `test`, and
`restoreSnapshot`. It stops at the recorded `failedAt` step and throws the
reproduced failure; if the failure does not reproduce, it throws an error
saying so. A fixture recorded from a snapshot start requires `restoreSnapshot`.
The fixture's recorded machine `id` and `version` are checked against the
machine you pass.

`defaultEquivalent(left, right)` is the structural, key-order insensitive,
cycle-safe deep equality used to compare model projections against reference
and SUT observations. Use it to build a custom `equivalent` on top of the
default behavior.

`extractReplayPath(counterexample)` (exported from `@xstate/fast-check`) pulls
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
  adapter: fastCheckAdapter(),
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
