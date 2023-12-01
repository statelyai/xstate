---
'@xstate/react': major
---

The `options` prop has been added (back) to the `Context.Provider` component returned from `createActorContext`:

```tsx
const SomeContext = createActorContext(someMachine);

// ...

<SomeContext.Provider options={{ input: 42 }}>
  {/* ... */}
</SomeContext.Provider>;
```
