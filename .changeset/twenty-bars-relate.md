---
'@xstate/store': minor
---

Add `createStoreHook(…)` function for React. Creates a store hook that returns `[selectedValue, store]` instead of managing store instances manually.

```tsx
const useCountStore = createStoreHook({
  context: { count: 0 },
  on: {
    inc: (ctx, event: { by: number }) => ({
      ...ctx,
      count: ctx.count + event.by
    })
  }
});

// Usage
const [count, store] = useCountStore((s) => s.context.count);
store.trigger.inc({ by: 3 });

// Usage (no selector)
const [snapshot, store] = useCountStore();
```
