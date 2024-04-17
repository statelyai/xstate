---
'@xstate/react': patch
'@xstate/svelte': patch
'@xstate/vue': patch
---

The `useSelector(…)` hook from `@xstate/react` is now compatible with stores from `@xstate/store`.

```tsx
import { createStore } from '@xstate/store';
import { useSelector } from '@xstate/react';

const store = createStore(
  {
    count: 0
  },
  {
    inc: {
      count: (context) => context.count + 1
    }
  }
);

function Counter() {
  // Note that this `useSelector` is from `@xstate/react`,
  // not `@xstate/store/react`
  const count = useSelector(store, (state) => state.context.count);

  return (
    <div>
      <button onClick={() => store.send({ type: 'inc' })}>{count}</button>
    </div>
  );
}
```
