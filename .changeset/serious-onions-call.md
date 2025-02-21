---
'@xstate/store': minor
---

There is now a `useStore()` hook that allows you to create a local component store from a config object.

```tsx
import { useStore, useSelector } from '@xstate/store/react';

function Counter() {
  const store = useStore({
    context: {
      name: 'David',
      count: 0
    },
    on: {
      inc: (ctx, { by }: { by: number }) => ({
        ...ctx,
        count: ctx.count + by
      })
    }
  });
  const count = useSelector(store, (state) => state.count);

  return (
    <div>
      <div>Count: {count}</div>
      <button onClick={() => store.trigger.inc({ by: 1 })}>
        Increment by 1
      </button>
      <button onClick={() => store.trigger.inc({ by: 5 })}>
        Increment by 5
      </button>
    </div>
  );
}
```
