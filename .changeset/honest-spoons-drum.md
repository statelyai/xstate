---
'@xstate/react': patch
---

Options in `createActorContext` are now properly merged with provider options. Previously, provider options replaced the actor options.

```tsx
const { inspect } = createBrowserInspector();

const SomeContext = createActorContext(someMachine, { inspect });

// ...
// Options are now merged:
// { inspect: inspect, input: 10 }
<SomeContext.Provider options={{ input: 10 }}>
  {/* ... */}
</SomeContext.Provider>;
```
