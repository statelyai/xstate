---
'xstate': major
---

Actions and guards that follow eventless transitions will now receive the event that triggered the transition instead of a "null" event (`{ type: '' }`), which no longer exists:

```js
// ...
states: {
  a: {
    on: {
      SOME_EVENT: 'b'
    }
  },
  b: {
    always: 'c'
  },
  c: {
    entry: [(_, event) => {
      // event.type is now "SOME_EVENT", not ""
    }]
  }
}
// ...
```
