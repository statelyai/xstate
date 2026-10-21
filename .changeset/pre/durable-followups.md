---
'xstate': patch
---

Durable executions can pin a deterministic identity: `createDurable(machine, { executionId, ... })` makes session ids `<executionId>:<n>`, a deterministic function of actor-creation order, so hosts that journal the execution's own events can replay them — a journaled completion event still matches the child a replay re-creates.

```ts
const durable = createDurable(machine, {
  executionId: orderId,
  executeAction,
  waitForEvent
});
```

The new `runLogic` runtime operation makes the invoked async actor the primary durable unit: a developer writes a normal promise and the host journals the whole body as one entry — wrapping the provided thunk in its own step primitive, or re-running the registered logic on a remote executor from the actor's serializable `(src, input)` identity alone. `enq.step` remains for opt-in finer granularity.

```ts
runLogic: (actor, exec) => ctx.run(actor.address, exec)
```

A remote handle now carries its host-supplied incarnation token as its `sessionId` — one incarnation identity with one staleness rule (a ref that knows its incarnation compares it; one that does not defers to the owning runtime). The persisted `incarnation` field is unchanged.

Docs reposition `enq.step` as the hostless-durability tool (the snapshot is the journal; durable hosts use plain promise actors + `runLogic`), document the portable-action rule (named function + serializable args ships to a remote executor; closures run in-process), and add a "Driving effects yourself" section: `createDurable` is sugar over the pure `transition()` APIs, and hosts may execute the effect objects themselves.

Durable-execution docs now also cover quiescing in-flight steps before registering a durable wait, the ordered-effect replay guarantee, and that `runStep`'s `exec` closure must run in-process.
