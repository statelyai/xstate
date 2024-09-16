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

