---
title: Selectors
description: Derive values from store snapshots.
---

A selector turns a store snapshot into the value a consumer needs.

```ts
const selectTotal = (snapshot: SnapshotFromStore<typeof store>) =>
  snapshot.context.items.reduce((total, item) => total + item.price, 0);
```

Framework bindings subscribe to the selected value and avoid updates when it stays equal.

## TypeScript

Use `SnapshotFromStore<typeof store>` when a standalone selector needs an explicit snapshot type.

## Selectors cheatsheet

```ts
const value = selector(store.getSnapshot());
```
