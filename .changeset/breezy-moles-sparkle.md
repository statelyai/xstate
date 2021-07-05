---
'@xstate/react': minor
---

Just like `useInvoke(...)`, other types of actors can now be spawned from _behaviors_ using `useSpawn(...)`:

```tsx
import { fromReducer } from 'xstate/lib/behaviors';
import { useActor, useSpawn } from '@xstate/react';

type CountEvent = { type: 'INC' } | { type: 'DEC' };

const countBehavior = fromReducer(
  (count: number, event: CountEvent): number => {
    if (event.type === 'INC') {
      return count + 1;
    } else if (event.type === 'DEC') {
      return count - 1;
    }

    return count;
  },
  0 // initial state
);

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

const Component = () => {
  const countActorRef = useSpawn(countBehavior);
  const [count, send] = useActor(countActorRef);

  return (
    <div>
      Count: {count}
      <button onClick={() => send({ type: 'INC' })}>Increment</button>
      <button onClick={() => send({ type: 'DEC' })}>Decrement</button>
    </div>
  );
};
```
