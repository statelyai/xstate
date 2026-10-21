---
'xstate': major
---

Actor creation and startup are now separate effects in the array returned from `transition(...)` and `initialTransition(...)`. Creating an actor (`enq.spawn`, `enq.listen`, `enq.subscribeTo`, and `invoke`) emits a `@xstate.spawn` effect at the position where it was authored, while starting it is deferred to a `@xstate.start` effect appended to the end of the array. Listener/subscription starts run before child starts, each group in authored order.

This fixes a timing issue where `enq.listen` and `enq.subscribeTo` could miss events emitted synchronously while their target actor was starting up. Because the listener/subscription is now started before its target, those early events are captured:

```ts
entry: (_, enq) => {
  const child = enq.spawn(childLogic);
  // Now receives events emitted synchronously during child's startup
  enq.listen(child, 'ready', () => ({ type: 'CHILD_READY' }));
};
```

The fix holds both in the interpreter and for consumers that execute the effects array manually in order (for example serverless or manual executors).

Other consequences:

- Invoked actors now start after the state's entry actions have run, instead of before them.
- A stopped actor can no longer be restarted with `.start()`, including the root actor — `actor.stop(); actor.start()` is now a no-op. As a result, an actor that is spawned and stopped within the same macrostep (or an invoke whose state is entered and exited within one macrostep) never starts.
- For code inspecting the effects array: spawn metadata (`logic`, `src`, `input`) now lives on the `@xstate.spawn` effect, while `@xstate.start` carries only `{ actor, id }`.
