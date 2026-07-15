---
'xstate': patch
---

Pure machine transitions now return an `@xstate.stop` effect whenever leaving a state stops an invoked actor. The effect exposes both the stopped `actor` and its `id`, including in `getMicrosteps(...)` and when the machine reaches its final state. Lifecycle effects are independently executable in order, so reentering an invoking state produces stop, spawn, then start effects that can be processed sequentially. Direct `machine.initialTransition(...)` and `machine.transition(...)` calls preserve their transition scope automatically, without requiring an `actorScope` argument.

```ts
const [nextSnapshot, effects] = transition(machine, snapshot, event);

for (const effect of effects) {
  if (isBuiltInExecutableAction(effect) && effect.type === '@xstate.stop') {
    console.log(effect.id, effect.actor);
  }
}
```
