---
'xstate': major
---

The `services` option passed as the second argument to `createMachine(config, options)` is renamed to `actors`. Each value in `actors` should be a function that takes in `context` and `event` and returns a [behavior](TODO: link) for an actor. The provided behavior creators are:

- `fromMachine`
- `fromPromise`
- `fromCallback`
- `fromObservable`
- `fromEventObservable`

```diff
import { createMachine } from 'xstate';
+import { fromPromise } from 'xstate/actors';

const machine = createMachine(
  {
    // ...
    invoke: {
      src: 'fetchFromAPI'
    }
  },
  {
-   services: {
+   actors: {
-     fetchFromAPI: (context, event) => {
+     fetchFromAPI: (context, event) => fromPromise(() => {
        // ... (return a promise)
      })
    }
  }
);
```
