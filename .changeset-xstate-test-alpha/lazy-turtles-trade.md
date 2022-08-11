---
'@xstate/test': major
---

pr: #3036
author: @mattpocock
author: @davidkpiano

Added `states` to `path.test()`:

```ts
const paths = model.getPaths().forEach((path) => {
  path.test({
    states: {
      myState: () => {},
      'myState.deep': () => {}
    }
  });
});
```

This allows you to define your tests outside of your machine, keeping the machine itself easy to read.
