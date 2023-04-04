---
'xstate': major
---

Action arguments are now consolidated into a single object argument. This is a breaking change for all actions that are called with arguments.

```diff
assign({
- count: (context, event) => {
+ count: ({ context, event }) => {
    return context.count + event.value;
  }
})
```
