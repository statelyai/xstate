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

Use `can(...)` to check whether an event would take a non-forbidden transition. Use tags when several states share the same UI meaning.

```ts
loading: {
  tags: ['busy']
}

snapshot.can({ type: 'submit' });
snapshot.hasTag('busy');
snapshot.getMeta();
```

For example, `uploading` and `processing` can both have a `busy` tag. A checkout button can use `can({ type: 'submit' })` without duplicating the machine's rules.

State metadata must match the machine's configured meta schema. `getMeta()` returns metadata for every active state node.

Atomic states have no children. Parent states have children. Parallel states activate every child region. Final states complete their parent. History states remember a previous child.

## TypeScript

Literal state keys are inferred from the machine configuration.

## States cheatsheet

```ts
snapshot.value;
snapshot.matches('idle');
snapshot.matches({ loading: 'user' });
snapshot.can({ type: 'submit' });
snapshot.hasTag('busy');
snapshot.context;
snapshot.status;
snapshot.children;
```
