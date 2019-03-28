# Usage with RxJS

The [interpreted machine](../guides/interpretation.md) (i.e., `service`) can be used as an event emitter. With RxJS, the `fromEventPattern()` Observable creator can be used to turn the `service` into an observable stream of `currentState` objects:

```js
import { Machine, interpret } from 'xstate';
import { fromEventPattern, merge } from 'rxjs';

const machine = Machine({
  /* machine definition */
});

const service = interpret(machine);

const state$ = fromEventPattern(
  handler => {
    service
      // Listen for state transitions
      .onTransition(handler)
      // Start the service
      .start();

    return service;
  },
  (handler, service) => service.stop()
);

// observable stream of events from various sources
const event$ = merge(/* ... */);

state$.subscribe(state => {
  // Logs the current state
  console.log(state);
});

event$.subscribe(event => service.send(event));
```
