# `@xstate/fast-check`

FastCheck adapter for generator-neutral XState property testing.

## Installation

<!-- install command matching package.json peerDependencies -->

```bash
pnpm add -D @xstate/fast-check fast-check
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
Use a descriptor to name a behavioral case or make it state-aware:

```ts
events: {
  INC: {
    case: 'positive',
    generate: fc.record({ value: fc.integer({ min: 1 }) }),
    when: ({ snapshot }) => snapshot.matches('active')
  }
}
```

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

Use `replayPropertyTest()` to replay versioned fixtures without FastCheck and
`formatPropertyTrace()` for a readable XState trace. Engine-native seed/path
metadata remains available on `PropertyTestFailure.replay`.

The optional `@xstate/fast-check/effect-schema` entrypoint converts Effect
Schemas into FastCheck arbitraries without adding Effect to XState.
