---
'xstate': major
---

Built-in executable effects returned from `transition(...)` and `initialTransition(...)` are now easier to inspect declaratively.

Use `isBuiltInExecutableAction(effect)` to narrow an executable effect to XState's built-in effect union, then switch on `effect.type` to access stable, named metadata fields:

```ts
const [snapshot, effects] = initialTransition(machine);

for (const effect of effects) {
  if (!isBuiltInExecutableAction(effect)) {
    continue;
  }

  switch (effect.type) {
    case '@xstate.start':
      effect.id;
      effect.logic;
      effect.src;
      effect.input;
      break;

    case '@xstate.sendTo':
      effect.target;
      effect.event;
      effect.delay;
      break;

    case '@xstate.raise':
      effect.event;
      effect.delay;
      break;
  }
}
```

The built-in stop effect is now exposed as `@xstate.stop`, matching `@xstate.start`.
