---
'xstate': minor
---

The `clock` and `logger` specified in the `options` object of `createActor(logic, options)` will now propagate to all actors created within the same actor system.

```ts
// Example showing that a custom logger applies to a child actor as well

import { setup, log, createActor } from 'xstate';

const childMachine = setup({
  // ...
}).createMachine({
  // ...
  // Uses custom logger from root actor
  entry: log('something')
});

const parentMachine = setup({
  // ...
}).createMachine({
  // ...
  invoke: {
    src: childMachine
  }
});

const actor = createActor(parentMachine, {
  logger: (...args) => {
    // custom logger for args
  }
});

actor.start();
```
