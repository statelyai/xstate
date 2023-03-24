---
'xstate': major
---

Autoforwarding events is no longer supported and the `autoForward` property has been removed.

Instead of autoforwarding, events should be explicitly sent to actors:

```diff
invoke: {
  id: 'child',
  src: 'someSrc',
- autoForward: true
},
// ...
on: {
  // ...
+ EVENT_TO_FORWARD: {
+   actions: sendTo('child', (_, event) => event)
+ }
}
```
