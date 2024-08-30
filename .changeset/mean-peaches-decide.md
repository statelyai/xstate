---
'@xstate/store': minor
---

You can now use the xstate/store package with SolidJS.

Import `useSelector` from `@xstate/store/solid`. Select the data you want via `useSelector(…)` and send events using `store.send(eventObject)`:

```tsx
import { donutStore } from './donutStore.ts';
import { useSelector } from '@xstate/store/solid';

function DonutCounter() {
  const donutCount = useSelector(donutStore, (state) => state.context.donuts);

  return (
    <div>
      <button onClick={() => donutStore.send({ type: 'addDonut' })}>
        Add donut ({donutCount()})
      </button>
    </div>
  );
}
```
