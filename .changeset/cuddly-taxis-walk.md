---
'xstate': minor
---

Add `assertEvent(...)` to help provide strong typings for events that can't be easily inferred, such as events in `entry` and `exit` actions, or in `invoke.input`.

The `assertEvent(event, 'someType')` function will _throw_ if the event is not the expected type. This ensures that the `event` is guaranteed to have that type, and assumes that the event object has the expected payload (naturally enforced by TypeScript).

```ts
// ...
entry: ({ event }) => {
  assertEvent(event, 'greet');
  // event is { type: 'greet'; message: string }

  assertEvent(event, ['greet', 'notify']);
  // event is { type: 'greet'; message: string }
  // or { type: 'notify'; message: string; level: 'info' | 'error' }
},
exit: ({ event }) => {
  assertEvent(event, 'doNothing');
  // event is { type: 'doNothing' }
}
```
