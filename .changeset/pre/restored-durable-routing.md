---
'xstate': patch
---

Restoring an externally migrated live snapshot now treats its `machine` property as a runtime association rather than persisted version metadata. Persisted snapshots continue validating their nested `{ id, version }` identity and legacy top-level `version` together.

`getNextTransitions(snapshot)` returns an empty array for completed or errored snapshots.

Setup-created machines whose input schema accepts `undefined` no longer require a meaningless `input` property when other actor options are provided, including after `machine.provide(...)`.

Durable adapters can implement `enqueueRootEvent` when the host owns only the execution root's mailbox, without overriding delivery for co-located actors:

```ts
const durable = createDurable(machine, {
  enqueueRootEvent: (_source, event) => host.enqueue(event),
  executeAction,
  waitForEvent
});
```

Implement `sendEvent` only when the host owns routing for every target; use `deliverEvent` for co-located delivery. Durable replay guidance now explicitly covers inline entry and exit callbacks.
