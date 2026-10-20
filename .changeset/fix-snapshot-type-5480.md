---
'xstate': patch
'@xstate/react': patch
---

Fix `ActorOptions.snapshot` and `Actor.getPersistedSnapshot()` to return `SnapshotFrom<TLogic>` instead of `Snapshot<unknown>`, so that rehydrating a machine from a persisted snapshot no longer produces TypeScript errors.

```ts
const persisted = actor.getPersistedSnapshot(); // typed SnapshotFrom<TMachine>
useMachine(machine, { snapshot: persisted }); // now typechecks
```

Resolves [#5480](https://github.com/statelyai/xstate/issues/5480).
