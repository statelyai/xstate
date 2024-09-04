---
'@xstate/store': minor
---

You can now emit events from a store:

```ts
import { createStore } from '@xstate/store';

const store = createStore(
  {
    count: 0
  },
  {
    increment: (context, event, { emit }) => {
      emit({ type: 'incremented' });
      return { count: context.count + 1 };
    }
  }
);
```

You can make emitted events type-safe via `setup({ schema: { … } })` (with Zod) or `setup({ types: { … } })` (with coerced types):

```ts
import { setup } from '@xstate/store';

const store = setup({
  schema: {
    emitted: {
      incremented: z.object({ by: z.number() })
    }
  }
}).createStore(
  {
    count: 0
  },
  {
    increment: (context, event, { emit }) => {
      emit({ type: 'incremented', by: 1 });
      return { count: context.count + 1 };
    }
  }
);
```
