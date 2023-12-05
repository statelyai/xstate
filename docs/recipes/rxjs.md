# Usage with RxJS

:::warning These XState v4 docs are no longer maintained

XState v5 is out now! [Read more about XState v5](https://stately.ai/blog/2023-12-01-xstate-v5) and [check out the XState v5 docs](https://stately.ai/docs/xstate).

:::

The [interpreted machine](../guides/interpretation.md) (i.e., `service`) is subscribable.

```js
import { createMachine, interpret } from 'xstate';
import { from } from 'rxjs';

const machine = createMachine(/* ... */);
const service = interpret(machine).start();

const state$ = from(service);

state$.subscribe((state) => {
  // ...
});
```
