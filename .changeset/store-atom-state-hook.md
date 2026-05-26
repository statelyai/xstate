---
'@xstate/store': minor
'@xstate/store-react': minor
'@xstate/store-preact': minor
'@xstate/store-vue': minor
'@xstate/store-solid': minor
---

Add reusable atom configs and framework atom-state helpers.

`createAtomConfig(...)` creates an inert atom definition that can be instantiated with `createAtom(...)` or React/Preact/Vue/Solid's `useAtomState(...)`. These helpers return the current framework-native value and live atom instance, and also work with existing atom instances.

```ts
const countConfig = createAtomConfig((input: { initialCount: number }) => {
  return input.initialCount;
});

function Counter() {
  const [count, countAtom] = useAtomState(countConfig, { initialCount: 0 });

  return (
    <button onClick={() => countAtom.set((count) => count + 1)}>
      {count}
    </button>
  );
}
```
