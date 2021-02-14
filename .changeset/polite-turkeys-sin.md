---
'@xstate/react': minor
---

New hook: `useSelector(actor, selector)`, which subscribes to `actor` and returns the selected state derived from `selector(snapshot)`:

```js
import { useSelector } from '@xstate/react';

const App = ({ someActor }) => {
  const count = useSelector(someActor, (state) => state.context.count);

  // ...
};
```
