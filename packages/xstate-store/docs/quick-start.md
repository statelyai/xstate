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

Stores work well for a shopping cart, editable table or shared filters. Use XState instead when events depend on a current state, such as a checkout that only accepts `pay` while it is `reviewing`.

## Reusable store logic

Use `createStoreLogic(...)` when several store instances share transitions but start with different input.

```ts
import { createStoreLogic } from '@xstate/store';

const counterLogic = createStoreLogic({
  context: (initialCount: number) => ({ count: initialCount }),
  on: {
    increment: (context) => ({ count: context.count + 1 })
  }
});

const firstCounter = counterLogic.createStore(0);
const secondCounter = counterLogic.createStore(10);
```

This fits one cart per shop widget or one editable draft per open tab.

## TypeScript

Context and event types are inferred from the store configuration.

## Store cheatsheet

```ts
store.send({ type: 'event' });
store.trigger.event();
store.getSnapshot();
store.subscribe((snapshot) => console.log(snapshot.context));
createStoreLogic(config).createStore(input);
```
