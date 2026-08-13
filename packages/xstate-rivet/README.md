# `@xstate/rivet`

Experimental Rivet Actor workflow adapter for XState durable execution.

<!-- install command for package.json#name and peerDependencies -->

```sh
pnpm add @xstate/rivet rivetkit xstate
```

<!-- public API from src/index.ts -->

```ts
import { createDurable } from '@xstate/rivet';
import { workflow } from 'rivetkit/workflow';

const run = workflow(async (context) => {
  const output = await createDurable(machine, {
    context,
    queue: 'machine-events',
    runtime: ({ id }, effect) => host.runtimeFor(id, effect)
  }).run(input);
});
```

The adapter maps custom actions to `context.step()` and receives machine events
from a Rivet queue. The `runtime` callback maps XState timers, sends, emits and
child lifecycle effects to Rivet operations. It receives the complete effect,
including the event, target, actor source and input needed for that mapping.

Only root completion has a default runtime mapping. Any other unmapped runtime
operation throws. A full timer mapping must preserve event/timer races and
cancellation, typically using Rivet workflow race and queue primitives rather
than awaiting `context.sleep()` inline.

Use `createRivetAdapter()` with XState's lower-level `createDurable()` when you
need to assemble the transition loop yourself.

## Tests

<!-- test layers from vitest configs and package.json#scripts -->

Fast context-contract tests run in the normal monorepo suite. Runtime
integration tests are opt-in and run serially against an externally managed
Rivet test endpoint, so the suite never starts or leaks an engine process:

```sh
XSTATE_RIVET_TEST_ENDPOINT=http://127.0.0.1:6420 \
  pnpm --filter @xstate/rivet test:integration
```
