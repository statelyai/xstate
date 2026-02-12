---
'xstate': minor
---

Added routable states. States with `route: {}` and an explicit `id` can be navigated to from anywhere via a single `{ type: 'xstate.route', to: '#id' }` event.

```ts
const machine = setup({}).createMachine({
  id: 'app',
  initial: 'home',
  states: {
    home: { id: 'home', route: {} },
    dashboard: {
      initial: 'overview',
      states: {
        overview: { id: 'overview', route: {} },
        settings: { id: 'settings', route: {} }
      }
    }
  }
});

const actor = createActor(machine).start();

// Route directly to deeply nested state from anywhere
actor.send({ type: 'xstate.route', to: '#settings' });
```

Routes support guards for conditional navigation:

```ts
settings: {
  id: 'settings',
  route: {
    guard: ({ context }) => context.role === 'admin'
  }
}
```
