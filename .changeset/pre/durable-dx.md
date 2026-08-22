---
'xstate': patch
---

Durable execution DX improvements:

- The drive loop no longer routes root events by hand. `executeEffects` retains the root-addressed events it captures, and `execution.waitForEvent()` hands them out before deferring to the adapter, so the canonical loop is:

  ```ts
  let [state, effects] = execution.initialTransition(input);
  await execution.executeEffects(effects);

  while (state.status === 'active') {
    [state, effects] = execution.transition(state, await execution.waitForEvent());
    await execution.executeEffects(effects);
  }
  ```

  (`executeEffects` now resolves with `void`.)

- `createDurable(logic, adapter, { inspect })` observes the execution's inspection events (`@xstate.actor` / `@xstate.transition`) across the whole live actor tree, including transitions computed by the pure path — the host-side home for operation logs and instrumentation.
- `execution.getActorRef(snapshot, address)` resolves a logical address against the snapshot's live actor tree, for hosts whose durable mailbox stores addresses as strings.
- Machine `output` types infer from the config's `output` function when no `schemas.output` schema is declared; a declared schema stays authoritative.
- `DurableSnapshot` keeps the `status`/`output`/`error` discriminant visible when `TLogic` is an unresolved type parameter, and adapter `waitForEvent` implementations may return plain event objects — generic host libraries no longer need casts.
