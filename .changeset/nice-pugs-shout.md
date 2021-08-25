---
'xstate': minor
---

You can now know if an event will cause a state change by using the new `state.can(event)` method, which will return `true` if the machine will change the state when sent the `event`, or `false` otherwise:

```js
const machine = createMachine({
  initial: 'inactive',
  states: {
    inactive: {
      on: {
        TOGGLE: 'active'
      }
    },
    active: {
      on: {
        DO_SOMETHING: { actions: ['something'] }
      }
    }
  }
});

const state = machine.initialState;

state.can('TOGGLE'); // true
state.can('DO_SOMETHING'); // false

// Also takes in full event objects:
state.can({
  type: 'DO_SOMETHING',
  data: 42
}); // false
```
