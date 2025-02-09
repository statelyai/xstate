---
'@xstate/store': major
---

Only complete assigner functions that replace the `context` fully are supported. This is a breaking change that simplifies the API and provides more type safety.

```diff
const store = createStore({
  context: {
    items: [],
    count: 0
  },
  on: {
-   increment: { count: (context) => context.count + 1 }
-   increment: (context) => ({ count: context.count + 1 })
+   increment: (context) => ({ ...context, count: context.count + 1 })
  }
})
```
