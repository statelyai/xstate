---
'xstate': major
---

The error event (`type: 'xstate.error.*'`) now has the error data on the `event.error` instead of `event.data`:

```diff
// ...
invoke: {
  src: 'someSrc',
  onError: {
    actions: ({ event }) => {
-     event.data;
+     event.error;
    }
  }
}
```
