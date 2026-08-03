---
title: Quick start
description: Create and use an XState Store.
---

Use XState Store when you need event-based state without a state machine.

```bash
npm install @xstate/store@alpha
```

```ts
import { createStore } from '@xstate/store';

const store = createStore({
  context: { count: 0 },
  on: {
    increment: (context) => ({ count: context.count + 1 })
  }
});

store.subscribe((snapshot) => console.log(snapshot.context.count));
store.send({ type: 'increment' });
```

Use `store.trigger.increment()` when the event has been declared by name.

## TypeScript

Context and event types are inferred from the store configuration.

## Store cheatsheet

```ts
store.send({ type: 'event' });
store.trigger.event();
store.getSnapshot();
```
