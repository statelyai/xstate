---
'@xstate/react': patch
---

Added an explicit entrypoint for `@xstate/react/fsm` which you can use instead of `@xstate/react/lib/fsm`. This is the only specifier that will be supported in the future - the other one will be dropped in the next major version.

```diff
-import { useMachine } from '@xstate/react/lib/fsm'
+import { useMachine } from '@xstate/react/fsm'
