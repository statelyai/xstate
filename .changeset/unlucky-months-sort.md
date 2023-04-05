---
'xstate': major
---

Strict mode is no longer available. You can no longer set `strict: true` to control:

- if a machine gets stopped or not when receiving unhandled rejection events from children
- if a machine throws an error when receiving events with unknown types

For handling unknown event types, wildcard transitions should be used if you want to explicitly handle undesired events:

```diff
const machine = createMachine({
- strict: true,
  // ...
  on: {
+   '*': {
+     actions: ({ event }) => {
+       throw new Error(`Event "${event.type}" not allowed`);
+     }
+   }
  }
})
```
