---
'xstate': minor
---

Use `actor.send(event, { allowRuntimeEvents: false })` when forwarding application input to reject runtime control events such as actor completions, errors and timer notifications. Rejected events are reported through `onRejectedEvent` with reason `'internalEvent'`, even without a runtime validator. This works for local and remote actor refs.

```ts
actor.send({ type: 'submit', name: 'Ada' }, { allowRuntimeEvents: false });
```

The option defaults to `true`, preserving existing host delivery and replay. Runtime-generated notifications and internally raised events continue normally, and declared internal events remain unavailable to external senders under either setting.

Asynchronous host rejection failures follow XState's unhandled-error reporting policy.
