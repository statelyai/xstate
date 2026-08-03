---
title: States
description: Define state nodes and read machine snapshots.
---

State nodes are values in a machine's `states` object.

```ts
const machine = createMachine({
  initial: 'idle',
  states: {
    idle: {},
    active: {},
    complete: { type: 'final' }
  }
});
```

## State snapshots

```ts
const snapshot = actor.getSnapshot();
snapshot.value;
snapshot.context;
snapshot.status;
snapshot.children;
```

Use `matches(...)` to check a state.

```ts
snapshot.matches('active');
snapshot.matches({ loading: 'user' });
```

Atomic states have no children. Parent states have children. Parallel states activate every child region. Final states complete their parent. History states remember a previous child.

## TypeScript

Literal state keys are inferred from the machine configuration.

## States cheatsheet

```ts
snapshot.value;
snapshot.matches('idle');
snapshot.matches({ loading: 'user' });
snapshot.context;
snapshot.status;
snapshot.children;
```
