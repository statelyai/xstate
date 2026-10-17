---
"xstate": minor
---

Actor logic exposes optional `completion` metadata: `'never'` for callback, listener, subscription, empty actor and FSM logic; `'possible'` for logic that supports completion. Machines report their structural completion capability. Custom `createLogic()` may declare `completion: 'never'`.

This describes whether an actor can produce a `done` snapshot. It does not determine current activity or guarantee that a run will finish.

```ts
const listener = createCallbackLogic(() => {});
listener.completion; // 'never'
```
