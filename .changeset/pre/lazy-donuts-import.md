---
'xstate': patch
---

Named imports from the root `xstate` entry (such as the actor logic creators and `SpecialTargets`) now work in all environments, including tools that load the package as CommonJS.

```ts
import { createAsyncLogic } from 'xstate'; // now works everywhere
```
