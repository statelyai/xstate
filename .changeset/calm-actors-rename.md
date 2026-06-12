---
'xstate': major
---

Remove the legacy `from*` actor logic creators in favor of the `create*Logic` names. These are same-signature renames (except `fromPromise`, removed earlier in favor of config-based `createAsyncLogic`):

| Removed               | Use instead                              |
| --------------------- | ---------------------------------------- |
| `fromCallback`        | `createCallbackLogic` (same args)        |
| `fromObservable`      | `createObservableLogic` (same args)      |
| `fromEventObservable` | `createEventObservableLogic` (same args) |
| `fromTransition`      | `createTransitionLogic` (same args)      |

```diff
- import { fromCallback, fromTransition } from 'xstate';
+ import { createCallbackLogic, createTransitionLogic } from 'xstate';

- const listener = fromCallback(({ sendBack, receive }) => { ... });
+ const listener = createCallbackLogic(({ sendBack, receive }) => { ... });

- const counter = fromTransition((count, event) => count + 1, 0);
+ const counter = createTransitionLogic((count, event) => count + 1, 0);
```
