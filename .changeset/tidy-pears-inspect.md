---
'@xstate/store-react': minor
---

The `useStore` hook now accepts an `inspect` option for wiring up inspectors to component-local stores. The inspector is subscribed when the component mounts and unsubscribed when it unmounts, and stays stable across re-renders.

```tsx
import { useStore, useSelector } from '@xstate/store-react';
import { createBrowserInspector } from '@statelyai/inspect';

const inspector = createBrowserInspector();

function Counter() {
  const store = useStore(
    {
      context: { count: 0 },
      on: {
        inc: (context) => ({ count: context.count + 1 })
      }
    },
    { inspect: inspector.inspect }
  );
  const count = useSelector(store, (s) => s.context.count);

  return <button onClick={() => store.send({ type: 'inc' })}>{count}</button>;
}
```
