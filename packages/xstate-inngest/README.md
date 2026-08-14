# `@xstate/inngest`

Experimental Inngest adapter for XState durable execution.

<!-- install command for package.json#name and peerDependencies -->

```sh
pnpm add @xstate/inngest inngest xstate
```

<!-- public API from src/index.ts -->

| Export | Purpose |
| --- | --- |
| `createDurable` | Alias for `createInngestDurable()` |
| `createInngestDurable(logic, options)` | Creates an execution using the current Inngest step tools |
| `createInngestAdapter(options)` | Creates only the adapter for a custom transition loop |
| `InngestEventWaitTimeoutError` | Error thrown when `waitForEvent()` times out |
| `InngestDurableOptions` | Adapter options type |

```ts
import { createDurable } from '@xstate/inngest';

const output = await createDurable(machine, {
  step,
  event: 'machine/event',
  timeout: '30 days',
  if: 'async.data.actorId == event.data.actorId',
  runtime: ({ id }, effect) => host.runtimeFor(id, effect)
}).run(input);
```

The adapter maps custom actions to `step.run()` and event waits to
`step.waitForEvent()`. The `runtime` callback maps XState timers, sends, emits
and child lifecycle effects to application-specific Inngest operations. It
receives the complete effect, including the event, target, actor source and
input needed for that mapping.

Every runtime mapping must itself use an Inngest durable primitive or be
idempotent using the supplied effect ID. Plain I/O in a runtime method repeats
when Inngest replays the function.

Only root completion has a default runtime mapping. Any other unmapped runtime
operation throws. Inngest's event wait is not a general mailbox: events sent
before the wait is registered require sender discipline or an application
inbox. Likewise, cancellable timers require an application timer/inbox design;
an inline `step.sleep()` would block intervening events and cancellation.
When `step.waitForEvent()` times out, the adapter throws
`InngestEventWaitTimeoutError`; it does not send a timeout event to the machine.

Use `createInngestAdapter()` with XState's lower-level `createDurable()` when
you need to assemble the transition loop yourself.

Fast context-contract tests run in the normal monorepo suite.
