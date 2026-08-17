---
'xstate': major
---

Remove the legacy `from*` actor logic creators in favor of the `create*Logic` names. These are same-signature renames except `fromPromise`, removed earlier in favor of config-based `createAsyncLogic`, and `fromTransition`, which should be migrated to `createLogic({ context, run })`:

| Removed               | Use instead                              |
| --------------------- | ---------------------------------------- |
| `fromCallback`        | `createCallbackLogic` (same args)        |
| `fromObservable`      | `createObservableLogic` (same args)      |
| `fromEventObservable` | `createEventObservableLogic` (same args) |
| `fromTransition`      | `createLogic({ context, run })`          |

```diff
- import { fromCallback, fromTransition } from 'xstate';
+ import { createCallbackLogic, createLogic } from 'xstate';

- const listener = fromCallback(({ sendBack, receive }) => { ... });
+ const listener = createCallbackLogic(({ sendBack, receive }) => { ... });

- const counter = fromTransition((count, event) => count + 1, 0);
+ const counter = createLogic({
+   context: 0,
+   run: ({ context }) => ({ context: context + 1 })
+ });
```
