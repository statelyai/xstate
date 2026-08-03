---
title: Events and context
description: Update store context in response to events.
---

Each transition receives the current context and event. Return the complete next context.

```ts
const store = createStore({
  context: { items: [] as string[] },
  on: {
    add: (context, event: { item: string }) => ({
      items: [...context.items, event.item]
    }),
    clear: () => ({ items: [] })
  }
});
```

Check whether the store accepts an event with its typed method on `store.can`.

## TypeScript

Declare event payloads in the transition parameter or use schema-backed store setup when runtime validation is needed.

## Events cheatsheet

```ts
store.send({ type: 'add', item: 'Milk' });
store.trigger.add({ item: 'Milk' });
store.can.clear();
```
