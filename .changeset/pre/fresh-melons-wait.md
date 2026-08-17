---
'xstate': minor
---

Add an experimental, host-neutral durable execution helper at `xstate/durable`.
It assigns stable IDs to effects and event waits from pure transitions while
leaving durable execution, timers, messaging and child actors to the host.
Hosts can read `nextTransitionIndex` after every transition for checkpointing.

```ts
const durable = createDurable(machine, adapter);
const output = await durable.run(input);
```
