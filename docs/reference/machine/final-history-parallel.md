---
title: Final, history and parallel states
description: Reference for advanced state node types.
---

## Final states

```ts
done: { type: 'final' }
```

A final state completes its parent.

## History states

```ts
history: { type: 'history', target: 'idle' }
```

Use `history: 'deep'` to remember nested descendants. A history state must define a default target.

## Parallel states

```ts
active: {
  type: 'parallel',
  states: {
    upload: { initial: 'idle', states: { idle: {}, running: {} } },
    validation: { initial: 'unchecked', states: { unchecked: {}, valid: {} } }
  }
}
```

## State node types cheatsheet

```ts
final: { type: 'final' }
history: { type: 'history', target: 'idle' }
parallel: { type: 'parallel', states: { first: {}, second: {} } }
```
