---
'xstate': major
'@xstate/codemod': minor
---

The executable action object types are renamed to executable effect types, matching the `[snapshot, effects]` tuple that transitions return:

| Before                                     | After                                       |
| ------------------------------------------ | ------------------------------------------- |
| `ExecutableActionObject`                   | `ExecutableEffect`                          |
| `ExecutableActionObjectFromLogic`          | `ExecutableEffectFrom`                      |
| `BaseExecutableActionObject`               | `BaseExecutableEffect`                      |
| `CustomExecutableActionObject`             | `CustomExecutableEffect`                    |
| `BuiltInExecutableActionObject`            | `BuiltInExecutableEffect`                   |
| `<Kind>ExecutableActionObject`             | `<Kind>ExecutableEffect`                    |
| `SpecialExecutableAction`                  | `SpecialExecutableEffect`                   |
| `ToExecutableAction`                       | `ToExecutableEffect`                        |
| `isBuiltInExecutableAction`                | `isBuiltInExecutableEffect`                 |

`<Kind>` is `Start`, `Spawn`, `Raise`, `SendTo`, `Emit`, `Cancel`, `Stop`, `Terminate`, or `DeadLetter`. The old names are not kept as aliases.

The `rename-imports` codemod renames the v5 `ExecutableActionObject`, `ExecutableActionsFrom`, `ExecutableSpawnAction`, `SpecialExecutableAction`, and `ToExecutableAction` imports to their new names. The other names, including `isBuiltInExecutableAction`, only existed in v6 alphas; rename them by hand.

```diff
- import { isBuiltInExecutableAction, type ExecutableActionObject } from 'xstate';
+ import { isBuiltInExecutableEffect, type ExecutableEffect } from 'xstate';
```
