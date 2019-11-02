# Usage with RxJS

The [interpreted machine](../guides/interpretation.md) (i.e., `service`) is subscribable.

```js
import { Machine, interpret } from 'xstate';
import { from } from 'rxjs';

const machine = Machine(/* ... */);
const service = interpret(machine).start();

const state$ = from(service);

state$.subscribe(state => {
  // ...
});
```
