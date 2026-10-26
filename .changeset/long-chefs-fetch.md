---
"@xstate/effect": minor
---

Preserve complete Effect Causes in task, stream and hosted action failures. Error snapshots and invoked child `onError` events now carry `EffectFailure<E>`; inspect `error.cause` instead of reading domain error properties directly. `join` and result atoms preserve typed failures, defects and interruption.

Add `createSnapshotCodec(machine, schema)` for validated JSON persistence with explicit rich-value schemas and existing machine migrations. Add `sendAndAwait` from `@xstate/effect/test` to acknowledge a specific mailbox event, including ignored events, and integrate with async `@xstate/test` SUT sessions.

Expose the `state` atom only for machine logic. Update Effect 4 compatibility and installation guidance.

```ts
const snapshot = yield* sendAndAwait(actor, event);
const json = yield* codec.encode(actor.getPersistedSnapshot());
const restored = yield* codec.decode(json);
```
  