---
'xstate': patch
---

The typing for `InvokeCallback` have been improved for better event constraints when using the `sendBack` parameter of invoked callbacks:

```ts
invoke: () => (sendBack, receive) => {
  // Will now be constrained to events that the parent machine can receive
  sendBack({ type: 'SOME_EVENT' });
};
```
