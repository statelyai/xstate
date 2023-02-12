---
'@xstate/react': minor
---

The `Provider` from `createActorContext(...)` now accepts the `options={{...}}` prop that takes the same object as the second argument to the `useMachine(machine, options)` hook.

These options are no longer passed as the second argument to the `createActorContext(machine)` function:

```diff

-const SomeContext = createActorContext(someMachine,
-  { actions: { ... } });
+const SomeContext = createActorContext(someMachine);

// ...

-<SomeContext.Provider>
+<SomeContext.Provider options={{ actions: { ... } }}>

// ...
```
