---
'@xstate/store': minor
---

Add `@xstate/store/core` for TypeScript consumers that do not install XState. It provides the same stores, atoms, and public types as the root entry, except `fromStore`. Existing root imports remain supported.

```ts
import { createStore } from '@xstate/store/core';
```

Store extensions also typecheck in Node-only applications without DOM declarations.
