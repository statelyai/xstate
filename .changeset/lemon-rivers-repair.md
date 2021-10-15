---
'xstate': patch
---

Fixed an issue with tags being missed on a service state after starting that service using a state value, like this:

```js
const service = interpret(machine).start('active');
service.state.hasTag('foo'); // this should now return a correct result
```
