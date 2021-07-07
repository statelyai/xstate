---
'@xstate/vue': minor
---

Just like `useInterpret(...)`, other types of actors can now be spawned from _behaviors_ using `useSpawn(...)`:

```vue
<template>
  <div>
    Count: {{ count }}
    <button @click="send({ type: 'INC' })">Increment</button>
    <button @click="send({ type: 'DEC' })">Decrement</button>
  </div>
</template>

<script>
import { fromReducer } from 'xstate/lib/behaviors';
import { useActor, useSpawn } from '@xstate/vue';

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

export default {
  setup() {
    const countActorRef = useSpawn(countBehavior);
    const { state: count, send } = useActor(countActorRef);

    return { count, send };
  }
};
</script>
```
