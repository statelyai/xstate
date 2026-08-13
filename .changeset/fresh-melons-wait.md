---
'xstate': minor
---

Add an experimental, host-neutral durable execution helper at `xstate/durable`.
It assigns stable IDs to effects from pure transitions while leaving durable
execution, event waiting, timers, messaging and child actors to the host.

```ts
const d = createDurableExecution(machine, adapter);
let [state, effects] = d.initialTransition(input);
await d.executeEffects(effects);

while (state.status === 'active') {
  const event = await d.waitForEvent();
  [state, effects] = d.transition(state, event);
  await d.executeEffects(effects);
}
```
