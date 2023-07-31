---
'xstate': patch
---

The `state.meta` values are now properly persisted and restored:

```ts
const machine = createMachine({
  id: 'm',
  initial: 'a',
  states: {
    a: {
      meta: { foo: 'bar' }
    }
  }
});

const actor = interpret(machine).start();
const state = actor.getSnapshot();

const persistedState = JSON.stringify(state);
const restoredState = State.create(JSON.parse(persistedState));

restoredState.meta;
// => { 'm.a': { foo: 'bar' } }
```
