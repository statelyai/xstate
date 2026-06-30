---
'xstate': patch
---

Fix `enq.listen()` and `enq.subscribeTo()` missing events emitted synchronously during a child actor's startup.

Both are now reordered to start before their target actor, so any events emitted during initialization are captured correctly. As part of this, a `subscribeTo` snapshot handler now also receives the actor's initial snapshot.

```ts
const child = createCallbackLogic(({ emit }) => {
  emit({ type: 'childEvent' }); // emitted during startup
});

const machine = createMachine({
  entry: (_, enq) => {
    const ref = enq.spawn(child, { id: 'child' });
    // previously had no effect — 'childEvent' was already emitted before the listener attached
    enq.listen(ref, 'childEvent', () => ({ type: 'HEARD' }));
    // same fix applies to enq.subscribeTo()
  }
});
```
