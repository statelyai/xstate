---
title: Final, history and parallel states
description: Reference for advanced state node types.
---

## Final states

```ts
done: { type: 'final' }
```

A final state completes its parent.

A top-level final state completes the machine actor. A parent state completes when one of its child final states is reached. A parallel state completes after every region reaches a final state.

Use final states when a checkout is confirmed or a batch has finished every job.

## History states

```ts
history: { type: 'history', target: 'idle' }
```

History is shallow by default and remembers the previous direct child. Use `history: 'deep'` to remember nested descendants. A history state must define a default target.

Use history when returning to the previous step of a form or restoring a media player to its previous playback mode.

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

Use parallel states when regions change independently, such as upload progress and validation, or playback and volume.

## State node types cheatsheet

```ts
final: { type: 'final' }
history: { type: 'history', target: 'idle' }
deepHistory: { type: 'history', history: 'deep', target: 'idle' }
parallel: { type: 'parallel', states: { first: {}, second: {} } }
```
