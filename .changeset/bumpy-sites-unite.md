---
"xstate": minor
---

Add experimental pure actor-system transitions with immutable world snapshots,
external effects as data, and chronological virtual time across actors.

```ts
const systemLogic = { root: machine };
const [world] = initialSystemTransition(systemLogic, { input });
const [nextWorld, effects] = systemTransition(systemLogic, world, world.root, event);
const [laterWorld] = advanceSystemTime(systemLogic, nextWorld, { time: 4000 });
```

`SimulatedClock` now runs callbacks at each timer's deadline before reaching the
requested time, including intermediate timers created during those callbacks.
