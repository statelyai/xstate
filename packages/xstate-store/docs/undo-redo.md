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

## Undo cheatsheet

```ts
historyStore.trigger.undo();
historyStore.trigger.redo();
```
