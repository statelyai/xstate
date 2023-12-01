---
'xstate': major
---

The `system` can now be accessed in all available actor logic creator functions:

```ts
fromPromise(({ system }) => { ... });

fromTransition((state, event, { system }) => { ... });

fromObservable(({ system }) => { ... });

fromEventObservable(({ system }) => { ... });

fromCallback((sendBack, receive, { system }) => { ... });
```
