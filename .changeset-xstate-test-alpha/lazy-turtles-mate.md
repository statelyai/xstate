---
'@xstate/test': major
---

pr: #3036
author: @mattpocock
author: @davidkpiano

Moved `events` from `createTestModel` to `path.test`.

Old:

```ts
const model = createTestModel(machine, {
  events: {}
});
```

New:

```ts
const paths = model.getPaths().forEach((path) => {
  path.test({
    events: {}
  });
});
```

This allows for easier usage of per-test mocks and per-test context.
