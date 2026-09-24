---
'xstate': minor
---

Address and transition nested children with the pure API: `getChildSnapshot`, `withChildSnapshot`, `transitionChild`, and `startActor`.

`transitionChild(machine, snapshot, address, event)` delivers an event to the actor at an absolute address inside a whole-tree snapshot and returns the next root snapshot. When the child completes, its completion is delivered to its parent in the same call, up the tree. `createDurable` executions get `durable.transitionChild`, which tags the whole cascade under one transition index. `startActor` joins the `stopActor` and `terminateActor` helpers for custom runtimes.

```ts
import { transitionChild } from 'xstate';

// A persisted grandchild timer fires
const snapshot = rootMachine.restoreSnapshot(persisted);
const [next, effects] = transitionChild(
  rootMachine,
  snapshot,
  'root/worker/retry',
  { type: 'xstate.timer', id: 'xstate.after.1000.retry.idle' }
);
// retry reached its final state, so worker and root reacted to their onDone
next.status; // 'done'
```

Folded `@xstate.terminate` effects carry `completionDelivered: true` as a plain field, which survives copying the effect (`{ ...effect }`) and appears in its effect descriptor. Executing the effect passes it in the termination handed to `runtime.terminateActor`; a custom runtime that copies or queues the termination must keep that field. `terminateActor(actor, termination)` then notifies observers without delivering the completion to the parent a second time.

A completion event built by hand has no `sessionId`, which bypasses stale-completion protection. Development builds now warn once per actor when one is delivered.
