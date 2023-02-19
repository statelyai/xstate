# Usage with RxJS

The [interpreted machine](../guides/interpretation.md) (i.e., `service`) is subscribable.

```js
import { createMachine, fromMachine } from '@xstate/rxjs';

const machine = createMachine(/* ... */);
const { state$, send, service } = fromMachine(machine);

state$.subscribe((state) => {
  // ...
});
```
