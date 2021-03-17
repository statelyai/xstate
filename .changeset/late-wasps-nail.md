---
'@xstate/vue': minor
---

Added new `useActor`, which is a composable that subscribes to emitted changes from an existing `actor`:

```js
import { useActor } from '@xstate/vue';

export default defineComponent({
  props: ['someSpawnedActor'],
  setup() {
    const { state, send } = useActor(someSpawnedActor);
    return { state, send };
  }
});
```
