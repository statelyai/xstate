---
'@xstate/store': major
'@xstate/store-react': major
'@xstate/store-preact': major
'@xstate/store-solid': major
'@xstate/store-vue': major
'@xstate/store-svelte': major
'@xstate/store-angular': major
---

Add `createStoreLogic(...)` for reusable store definitions, and support creating stores from logic in framework hooks.

```ts
const counterLogic = createStoreLogic({
  context: (input: { initialCount: number }) => ({
    count: input.initialCount
  }),
  on: {
    inc: (context) => ({ count: context.count + 1 })
  }
});

const store = useStore(counterLogic, { initialCount: 0 });
```

If a store logic requires input, the input argument is also required:

```ts
useStore(counterLogic, { initialCount: 0 });
```
