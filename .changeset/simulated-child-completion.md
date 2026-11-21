---
"xstate": minor
---

Enable `actor.simulate.childDone({ id, output })` with `createActor(machine, { simulate: true })`. Tests can finish an invoked child with a chosen output and still exercise child cleanup, the terminal snapshot, and the parent's `onDone` transition.
