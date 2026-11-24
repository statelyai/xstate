---
'xstate': minor
---

Macrosteps are unbounded by default, as in v5. `options.maxIterations` no longer defaults to `1000`, so a machine whose eventless transitions or raised events take more than 1000 microsteps for one event keeps running instead of erroring. In development builds, a macrostep that passes 1000 microsteps logs a warning once per machine. Set `maxIterations` to turn a runaway macrostep into an `InfiniteTransitionError`:

```ts
const machine = createMachine({
  options: { maxIterations: 5000 },
  // ...
});
```
