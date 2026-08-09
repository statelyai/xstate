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

The optional `@xstate/fast-check/effect-schema` entrypoint converts Effect
Schemas into FastCheck arbitraries without adding Effect to XState.
