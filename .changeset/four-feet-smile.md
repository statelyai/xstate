---
'xstate': minor
---

Actors can now be invoked/spawned from reducers using the `fromReducer(...)` behavior creator:

```ts
import { fromReducer } from 'xstate/lib/behaviors';

type CountEvent = { type: 'INC' } | { type: 'DEC' };

const countReducer = (count: number, event: CountEvent): number => {
  if (event.type === 'INC') {
    return count + 1;
  } else if (event.type === 'DEC') {
    return count - 1;
  }

  return count;
};

const countMachine = createMachine({
  invoke: {
    id: 'count',
    src: () => fromReducer(countReducer, 0)
  },
  on: {
    INC: {
      actions: forwardTo('count')
    },
    DEC: {
      actions: forwardTo('count')
    }
  }
});
```
