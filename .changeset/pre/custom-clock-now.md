---
'xstate': minor
---

Custom clocks may now provide `now()` so scheduled and restored timers use the same time source:

```ts
createActor(machine, {
  clock: {
    now: () => currentTime,
    setTimeout: (callback, delay) => schedule(callback, delay),
    clearTimeout: (handle) => cancel(handle)
  }
});
```
