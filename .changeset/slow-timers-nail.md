---
'xstate': patch
---

A regression was fixed where actions were being typed as `never` if events were specified in `createModel(...)` but not actions:

```ts
const model = createModel(
  {},
  {
    events: {}
  }
);

model.createMachine({
  // These actions will cause TS to not compile
  entry: 'someAction',
  exit: { type: 'someObjectAction' }
});
```
