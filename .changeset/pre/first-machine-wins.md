---
'@xstate/react': minor
---

`useActorRef()`, `useActor()` and `useMachine()` now use the machine passed on the first render for the lifetime of the component, like a `useState` initializer. Passing a different machine object on a later render no longer stops the actor and starts a new one from its persisted snapshot.

Creating the machine inside the component no longer resets state or causes render loops, so wrapping it in `useMemo` is no longer needed:

```tsx
function Toggle() {
  // Created on every render; only the first one is used.
  const [snapshot, send] = useMachine(createMachine({ /* ... */ }));
  // ...
}
```

Vary a running machine with `input` or `machine.provide()` (provided implementations are still picked up on every render). To switch to a different machine, change the component's `key`:

```tsx
<Editor key={mode} machine={mode === 'draft' ? draftMachine : reviewMachine} />
```
