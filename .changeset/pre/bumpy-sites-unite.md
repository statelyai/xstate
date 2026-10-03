---
"xstate": minor
---

Add experimental pure actor-system transitions with immutable system snapshots,
external effects as data, and chronological virtual time across actors.

```ts
const systemLogic = { root: machine };
const [snapshot] = initialSystemTransition(systemLogic, { input });
const [nextSnapshot, effects] = systemTransition(systemLogic, snapshot, snapshot.root, event);
const [laterSnapshot] = advanceSystemTime(systemLogic, nextSnapshot, { time: 4000 });
```

`SimulatedClock` now runs callbacks at each timer's deadline before reaching the
requested time, including intermediate timers created during those callbacks.
Large timer batches advance efficiently while preserving deadline and insertion
order. Subscription completion/error mappings arrive before native child
notifications, matching live actors.
