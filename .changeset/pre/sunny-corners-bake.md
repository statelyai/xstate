---
"xstate": patch
"@xstate/effect": patch
---

Events sent by a child actor to a parent started with `createEffectActor` now retain their send order, including bursts from promise continuations.

Durable hosts with a single FIFO mailbox can route all root events through their adapter:

```ts
const durable = createDurable(machine, adapter, { captureRootEvents: false });
```
