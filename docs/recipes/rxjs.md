# Usage with RxJS

The [interpreted machine](../guides/interpretation.md) (i.e., `service`) can be used as an event emitter. With RxJS, the `fromEventPattern()` Observable creator can be used to turn the `service` into an observable stream of `currentState` objects:

```js
import { Machine, interpret } from 'xstate';
import { fromEventPattern } from 'rxjs';

const machine = Machine({
  /* machine definition */
});

const service = interpret(machine);

const state$ = fromEventPattern(callback => {
  service.onTransition(callback);
});

state$.subscribe(state => {
  // Logs the current state
  console.log(state);
});

const event$ = state$.subscribe(event => {
  // a stream of event objects
  service.send(event);
});
```
