---
'@xstate/vue': minor
---

Added new composable `useSelector(actor, selector)`, which subscribes to actor and returns the selected state derived from selector(snapshot):

```js
import { useSelector } from '@xstate/vue';

export default {
  props: ['someActor'],
  setup(props) {
    const count = useSelector(props.someActor, (state) => state.context.count);
    // ...
    return { count };
  }
};
```
