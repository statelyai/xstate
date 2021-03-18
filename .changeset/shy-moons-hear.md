---
'@xstate/vue': minor
---

Added new `useInterpret`, which is a low-level composable that interprets the `machine` and returns the `service`:

```js
import { useInterpret } from '@xstate/vue';
import { someMachine } from '../path/to/someMachine';
export default defineComponent({
  setup() {
    const state = ref();
    const service = useInterpret(machine, {}, (nextState) => {
      state.value = nextState.value;
    });
    return { service, state };
  }
});
```
