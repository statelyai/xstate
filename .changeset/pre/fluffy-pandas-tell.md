---
'xstate': patch
---

Fixed a bug where `enq.subscribeTo(…)` and `enq.listen(…)` silently did nothing when called inside a transition function. They now work the same as in `entry` actions:

```ts
const machine = createMachine({
  on: {
    start: (_, enq) => {
      const child = enq.spawn(childLogic);
      enq.subscribeTo(child, {
        done: (output) => ({ type: 'childDone', output })
      });
    },
    childDone: ({ event }) => {
      // event.output is the child's output
    }
  }
});
```
