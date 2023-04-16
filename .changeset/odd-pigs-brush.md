---
'xstate': major
---

The `createNullActor()` function has been added to make it easier to create actors that do nothing ("null" actors). This is useful for testing, or for some integrations such as `useActor(actor)` in `@xstate/react` that require an actor:

```jsx
import { createNullActor } from 'xstate';

const SomeComponent = (props) => {
  // props.actor may be undefined
  const [state, send] = useActor(props.actor ?? createNullActor());

  // ...
};
```
