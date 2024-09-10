---
'@xstate/store': minor
---

You can now emit events from a store:

```ts
import { createStore } from '@xstate/store';

const store = createStore({
  context: {
    count: 0
  },
  on: {
    increment: (context, event, { emit }) => {
      emit({ type: 'incremented' });
      return { count: context.count + 1 };
    }
  }
});

store.on('incremented', () => {
  console.log('incremented!');
});
```

You can make emitted events type-safe via `createstore({ schema: { … } })` (with Zod) or `createStore({ types: { … } })` (with coerced types):

```ts
import { createStore } from '@xstate/store';
import { z } from 'zod';

const store = createStore({
  schema: {
    emitted: {
      incremented: z.object({ by: z.number() })
    }
  },
  context: {
    count: 0
  },
  on: {
    increment: (context, event, { emit }) => {
      emit({ type: 'incremented', by: 1 });
      return { count: context.count + 1 };
    }
  }
});

store.on('incremented', (event) => {
  console.log('Incremented by', event.by);
  // => "Incremented by 1"
});

store.send({ type: 'increment' });
```
