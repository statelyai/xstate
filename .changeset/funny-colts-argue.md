---
'xstate': minor
---

Persisted state can now be easily restored to a state compatible with the machine without converting it to a `State` instance first:

```js
// Persisting a state
someService.subscribe((state) => {
  localStorage.setItem('some-state', JSON.stringify(state));
});

// Restoring a state
const stateJson = localStorage.getItem('some-state');

// No need to convert `stateJson` object to a state!
const someService = interpret(someMachine).start(stateJson);
```
