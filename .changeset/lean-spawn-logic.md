---
'xstate': patch
---

Spawning registered actor logic from a machine context now preserves its actor source identity when persisting and rehydrating the child.

```ts
createMachine({
  actorSources: { child },
  context: ({ spawn, actorSources }) => {
    spawn(actorSources.child);
    return {};
  }
});
```
