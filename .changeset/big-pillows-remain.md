---
'xstate': minor
---

An error will be thrown if an `initial` state key is not specified for compound state nodes. For example:

```js
const lightMachine = createMachine({
  initial: 'green',
  states: {
    green: {},
    yellow: {},
    red: {
      // Forgotten initial state:
      // initial: 'walk',
      states: {
        walk: {},
        wait: {}
      }
    }
  }
});
```

You will get the error:

```
No initial state specified for state node "#red". Try adding { initial: "walk" }
```
