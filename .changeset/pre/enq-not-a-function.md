---
'xstate': patch
---

Enqueueing a value that is not a function, such as a named action that has no implementation, now enqueues nothing, and development builds log a warning. Before, it showed up as an event without a `type`: `actor.on('*')` listeners received it, inspection listed it as an action, and pure `transition()` returned it as an `emit` effect. A validated machine that declares `schemas.emitted` errored with "Unknown emitted event".

```ts
const machine = setup({
  schemas: { actions: { track: { params: z.object({ key: z.string() }) } } }
}).createMachine({
  on: {
    // `actions.track` is undefined until an implementation is provided
    submit: ({ actions }, enq) => {
      enq(actions.track, { key: 'submit' });
    }
  }
});
```
