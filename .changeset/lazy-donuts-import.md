---
'xstate': patch
---

The root `xstate` entry now re-exports actor logic creators (`createAsyncLogic`, `createCallbackLogic`, `createObservableLogic`, etc.) and `SpecialTargets` by name instead of via `export *`. This fixes named imports such as `import { createAsyncLogic } from 'xstate'` failing with "does not provide an export named" in environments that load the package as CommonJS and rely on static named-export detection (for example `tsx` in development).

```ts
import { createAsyncLogic } from 'xstate'; // now works everywhere
```
