---
title: Undo and redo
description: Add history controls to an XState Store.
---

Use the undo extension from `@xstate/store/undo`.

```ts
import { undoRedo } from '@xstate/store/undo';

const historyStore = store.with(undoRedo());
```

Send undo and redo events through the returned store. Keep transient UI data outside history when users should not undo it.

The event strategy replays store events. The snapshot strategy restores saved contexts.

```ts
const historyStore = store.with(
  undoRedo({
    strategy: 'snapshot',
    historyLimit: 100,
    getTransactionId: (event) =>
      'transactionId' in event ? String(event.transactionId) : undefined,
    skipEvent: (event) => event.type === 'cursorMoved'
  })
);
```

Use transactions to group several text edits into one undo step. Skip events such as cursor movement, presence and analytics.

Undo and redo fit document editors and drawing tools. They usually should not reverse network responses or another user's changes.

## TypeScript

The extension adds typed `undo` and `redo` methods to `trigger` and `can`.

## Undo cheatsheet

```ts
historyStore.trigger.undo();
historyStore.trigger.redo();
```
