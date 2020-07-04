---
'@xstate/fsm': minor
---

You can now rehydrate the state of a service by calling `start` with `initialState` argument:

```js
interpret(someMachine).start('active');

interpret(anotherMachine).start({
  value: 'active',
  context: { count: 42 }
});
