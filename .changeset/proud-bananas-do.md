---
'@xstate/store': minor
---

Added support for effect-only transitions that don't trigger state updates. Now, when a transition returns the same state but includes effects, subscribers won't be notified of a state change, but the effects will still be executed. This helps prevent unnecessary re-renders while maintaining side effect functionality.

```ts
it('should not trigger update if the snapshot is the same even if there are effects', () => {
  const store = createStore({
    context: { count: 0 },
    on: {
      doNothing: (ctx, _, enq) => {
        enq.effect(() => {
          // …
        });
        return ctx; // Context is the same, so no update is triggered
        // This is the same as not returning anything (void)
      }
    }
  });

  const spy = vi.fn();
  store.subscribe(spy);

  store.trigger.doNothing();
  store.trigger.doNothing();

  expect(spy).toHaveBeenCalledTimes(0);
});
```
