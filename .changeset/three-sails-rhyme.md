---
'xstate': minor
---

Added routable states. States with `route: {}` can be navigated to from anywhere via `xstate.route.{statePath}` events.

```ts
const machine = setup({}).createMachine({
  id: 'app',
  initial: 'home',
  states: {
    home: { route: {} },
    dashboard: {
      initial: 'overview',
      states: {
        overview: { route: {} },
        settings: { route: {} }
      }
    }
  }
});

const actor = createActor(machine).start();

// Route directly to deeply nested state from anywhere
actor.send({ type: 'xstate.route.app.dashboard.settings' });
```

Routes support guards for conditional navigation:

```ts
settings: {
  route: {
    guard: ({ context }) => context.role === 'admin';
  }
}
```
