---
title: Events and context
description: Update store context in response to events.
---

Each transition receives the current context and event. Return the complete next context.

```ts
import { createStore } from '@xstate/store';

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

```ts
if (store.can.add({ item: 'Milk' })) {
  store.trigger.add({ item: 'Milk' });
}
```

Transitions are pure calculations. They return context and enqueue effects, but do not mutate the current context.

Use events that describe what happened. `itemAdded` and `filtersCleared` are easier to trace than `setState`.

## Runtime schemas

Use Standard Schema-compatible validators when events cross a network, storage or user-input boundary.

```ts
import { createStore } from '@xstate/store';
import { z } from 'zod';

const store = createStore({
  schemas: {
    context: z.object({ items: z.array(z.string()) }),
    events: {
      add: z.object({ item: z.string() })
    }
  },
  context: { items: [] },
  on: {
    add: (context, event) => ({
      items: [...context.items, event.item]
    })
  }
});
```

## Pure transitions

`store.transition(...)` calculates the next snapshot and effects without updating the store or running those effects.

```ts
const [nextSnapshot, effects] = store.transition(store.getSnapshot(), {
  type: 'add',
  item: 'Milk'
});
```

Use pure transitions in tests, previews and server-side validation.

## TypeScript

Declare event payloads in the transition parameter or use schema-backed store setup when runtime validation is needed.

## Events cheatsheet

```ts
store.send({ type: 'add', item: 'Milk' });
store.trigger.add({ item: 'Milk' });
store.can.add({ item: 'Milk' });
store.transition(snapshot, event);
```
