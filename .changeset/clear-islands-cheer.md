---
'@xstate/react': patch
---

`useActor` (and `useMachine` by alias) now properly re-renders when an action throws, exposing `status: 'error'` and `error` on the snapshot.

```tsx
const App = () => {
  // Machine that might throw an error, e.g.:
  // entry: () => throw new Error('error');
  const [state, send, actor] = useActor(machine);

  const errorMessage =
    state.status === 'error' ? (state.error as Error)?.message : null;

  // ...
};
```
