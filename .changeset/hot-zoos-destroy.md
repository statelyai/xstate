---
'xstate': major
---

Action/actor/delay/guard arguments are now consolidated into a single object argument. This is a breaking change for all of those things that are called with arguments.

```diff
assign({
- count: (context, event) => {
+ count: ({ context, event }) => {
    return context.count + event.value;
  }
})
```
