---
'@xstate/graph': major
---

Test model path generation now has the option to allow duplicate paths by setting `allowDuplicatePaths: true`:

```ts
const paths = model.getSimplePaths({
  allowDuplicatePaths: true
});
// a
// a -> b
// a -> b -> c
// a -> d
// a -> d -> e
```

By default, `allowDuplicatePaths` is set to `false`:

```ts
const paths = model.getSimplePaths();
// a -> b -> c
// a -> d -> e
```
