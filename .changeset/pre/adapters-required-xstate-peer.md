---
'@xstate/react': patch
'@xstate/vue': patch
'@xstate/svelte': patch
'@xstate/solid': patch
---

`xstate` is now a required peer dependency of `@xstate/react`, `@xstate/vue`, `@xstate/svelte`, and `@xstate/solid`. Package managers now warn when `xstate` is missing instead of letting the adapter fail at runtime.

`useActorRef()`, `useActor()`, and `useMachine()` in `@xstate/react` no longer write implementations provided on a later render onto the machine passed on the first render. A module-level machine shared by several components keeps its own implementations:

```tsx
const machine = createMachine({
  actions: { notify: () => {} },
  on: { DO: ({ actions }, enq) => enq(actions.notify) }
});

function Custom({ onNotify }) {
  // Only this component's actor uses `onNotify`.
  useActorRef(machine.provide({ actions: { notify: onNotify } }));
  return null;
}

function Plain() {
  // Still uses the original `notify`.
  useActorRef(machine);
  return null;
}
```
