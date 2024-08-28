---
'xstate': patch
---

The `CallbackLogicFunction` type (previously `InvokeCallback`) is now exported. This is the callback function that you pass into `fromCallback(callbackLogicFn)` to create an actor from a callback function.

```ts
import { type CallbackLogicFunction } from 'xstate';

// ...
```
