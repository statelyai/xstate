---
title: Selectors
description: Derive values from store snapshots.
---

A selector returns the value a consumer needs. Framework selectors receive a store snapshot.

```ts
const selectTotal = (snapshot: SnapshotFromStore<typeof store>) =>
  snapshot.context.items.reduce((total, item) => total + item.price, 0);
```

Framework bindings subscribe to the selected value and avoid updates when it stays equal.

Use `store.select(...)` outside a framework. Its selector receives context and returns a readable value.

```ts
const total = store.select((context) =>
  context.items.reduce((sum, item) => sum + item.price, 0)
);

total.get();
total.subscribe((value) => console.log(value));
```

Select a cart total, visible rows or an unread count instead of subscribing every consumer to the whole store.

## Atoms

Use an atom for one independent value or a value derived from other atoms.

```ts
import { createAtom } from '@xstate/store';

const query = createAtom('');
const normalizedQuery = createAtom(() => query.get().trim().toLowerCase());

query.set('  State Machines  ');
normalizedQuery.get(); // 'state machines'
```

Use a reducer atom when updates are best expressed as events. Use a store when several values change together in named transitions.

## TypeScript

Use `SnapshotFromStore<typeof store>` when a standalone selector needs an explicit snapshot type.

## Selectors cheatsheet

```ts
const value = selector(store.getSnapshot());
const selected = store.select((context) => context.value);
selected.get();
const atom = createAtom(initialValue);
atom.get();
atom.set(nextValue);
```
