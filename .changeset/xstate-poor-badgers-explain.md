---
'xstate': major
---

Guard arguments are now consolidated into a single object argument. This is a breaking change for all guards that are called with arguments.

```diff
- guard: (context, event) => {
+ guard: ({ context, event }) => {
  return context.count + event.value > 10;
}
```
