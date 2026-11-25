---
"xstate": minor
---

Enable `actor.simulate.childDone({ id, output })` with `createActor(machine, { simulate: true })`. Tests can finish an invoked child with a chosen output and still exercise child cleanup, the terminal snapshot, and the parent's `onDone` transition.

Reject application sends of reserved lifecycle notifications. Host runtimes should pass co-located notifications through `deliverEvent` without cloning them and supply the current remote child as the source for verified remote notifications.
