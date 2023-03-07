---
'@xstate/test': major
---

pr: #3036
author: @davidkpiano

`getShortestPaths()` and `getPaths()` will now traverse all _transitions_ by default, not just all events.

Take this machine:

```ts
const machine = createTestMachine({
  initial: 'toggledOn',
  states: {
    toggledOn: {
      on: {
        TOGGLE: 'toggledOff'
      }
    },
    toggledOff: {
      on: {
        TOGGLE: 'toggledOn'
      }
    }
  }
});
```

In `@xstate/test` version 0.x, this would run this path by default:

```txt
toggledOn -> TOGGLE -> toggledOff
```

This is because it satisfies two conditions:

1. Covers all states
2. Covers all events

But this a complete test - it doesn't test if going from `toggledOff` to `toggledOn` works.

Now, we seek to cover all transitions by default. So the path would be:

```txt
toggledOn -> TOGGLE -> toggledOff -> TOGGLE -> toggledOn
```
