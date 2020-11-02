---
'@xstate/react': patch
---

The `send` value returned from the `useService()` hook will now accept a payload, which matches the signature of the `send` value returned from the `useMachine()` hook:

```js
const [state, send] = useService(someService);

// ...

// this is OK:
send('ADD', { value: 3 });

// which is equivalent to:
send({ type: 'ADD', value: 3 });
```
