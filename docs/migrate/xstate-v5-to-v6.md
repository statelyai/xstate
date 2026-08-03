---
title: Migrate from XState v5 to v6
description: Update machines and actors for XState v6.
---

XState v6 is currently in alpha. Upgrade one machine at a time and run its tests after each change.

```bash
npm install xstate@alpha
```

## Update actions

Transition, entry and exit functions can return the next context. Use the second argument to enqueue effects.

```ts
increment: ({ context }, enq) => {
  enq(() => analytics.track('increment'));
  return { context: { count: context.count + 1 } };
}
```

Replace built-in action creators with enqueue methods such as `enq.raise(...)`, `enq.sendTo(...)`, `enq.spawn(...)` and `enq.stop(...)`.

## Update schemas

Define runtime schemas in `setup({ schemas })`. Event schema keys create typed methods on `actor.trigger`.

## Update actor logic

Replace `fromPromise(...)` with `createAsyncLogic(...)`. Check other actor logic imports against the [actor logic reference](../reference/actors/actor-logic.md).

## Update framework hooks

In React, use `useActor(...)` for a machine and `useActorRef(...)` when the component only needs the actor reference. `useMachine(...)` is deprecated.

## Check persistence

Create new persisted snapshots with `getPersistedSnapshot()`. Test restoring snapshots created by versions already in production.

## Migration checklist

- Install the v6 alpha package.
- Update actions and built-in action creators.
- Update actor logic creators.
- Move runtime types into schemas.
- Update framework hooks.
- Test persisted snapshots.
- Run type checking and behavior tests.

See the [full migration guide](../../migration.md) for API-by-API changes.
