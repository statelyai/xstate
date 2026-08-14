# `@xstate/rivet`

Experimental Rivet Actor workflow adapter for XState durable execution.

<!-- install command for package.json#name and peerDependencies -->

```sh
pnpm add @xstate/rivet rivetkit xstate
```

<!-- public API from src/index.ts -->

| Export | Purpose |
| --- | --- |
| `createDurable` | Alias for `createRivetDurable()` |
| `createRivetDurable(logic, options)` | Creates an execution using a Rivet workflow context |
| `createRivetAdapter(options)` | Creates only the adapter for a custom transition loop |
| `RivetDurableOptions` | Adapter options type |
| `RivetDurableWorkflowContext` | Minimal workflow context accepted by the adapter |
| `RivetWorkflowContextOf` | Re-export of RivetKit's workflow context helper type |

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
from a Rivet queue. Each wait uses its stable `event:N` ID as the workflow
history entry name and filters messages by the configured queue. Rivet records
the selected message in workflow history and returns it on replay. The
`runtime` callback maps XState timers, sends, emits and child lifecycle effects
to Rivet operations. It receives the complete effect, including the event,
target, actor source and input needed for that mapping.

Every runtime mapping must itself use a Rivet durable workflow primitive or be
idempotent using the supplied effect ID. Plain I/O in a runtime method repeats
when Rivet replays the workflow.

Only root completion has a default runtime mapping. Any other unmapped runtime
operation throws. A full timer mapping must preserve event/timer races and
cancellation, typically using Rivet workflow race and queue primitives rather
than awaiting `context.sleep()` inline.

Use `createRivetAdapter()` with XState's lower-level `createDurable()` when you
need to assemble the transition loop yourself.

Fast context-contract tests run in the normal monorepo suite.
