---
'@xstate/react': minor
---

New hook: `useInterpret(machine)`, which is a low-level hook that interprets the `machine` and returns the `service`:

```js
import { useInterpret } from '@xstate/react';
import { someMachine } from '../path/to/someMachine';

const App = () => {
  const service = useInterpret(someMachine);

  // ...
};
```
