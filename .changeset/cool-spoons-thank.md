---
'@xstate/vue': major
---

The major version of this package had to be bumped to allow integrating with the typegen. This package will now require TS version 4.0 or greater.

When using hooks from `@xstate/vue` it's recommended to skip providing explicit generics to them. Note that that generics list has changed since v1 and we now only accept a single generic, `TMachine`.
