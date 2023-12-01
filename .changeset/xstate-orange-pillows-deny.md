---
'xstate': minor
---

Actor logic creators now have access to `self`:

```ts
const promiseLogic = fromPromise(({ self }) => { ... });

const observableLogic = fromObservable(({ self }) => { ... });

const callbackLogic = fromCallback((sendBack, receive, { self }) => { ... });

const transitionLogic = fromTransition((state, event, { self }) => { ... }, ...);
```
