---
'xstate': minor
---

All actor logic creators now support emitting events:

**Promise actors**

```ts
const logic = fromPromise(async ({ emit }) => {
  // ...
  emit({
    type: 'emitted',
    msg: 'hello'
  });
  // ...
});
```

**Transition actors**

```ts
const logic = fromTransition((state, event, { emit }) => {
  // ...
  emit({
    type: 'emitted',
    msg: 'hello'
  });
  // ...
  return state;
}, {});
```

**Observable actors**

```ts
const logic = fromObservable(({ emit }) => {
  // ...

  emit({
    type: 'emitted',
    msg: 'hello'
  });

  // ...
});
```

**Callback actors**

```ts
const logic = fromCallback(({ emit }) => {
  // ...
  emit({
    type: 'emitted',
    msg: 'hello'
  });
  // ...
});
```
