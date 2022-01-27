---
'@xstate/react': major
---

author: @Andarist
author: @mattpocock

To avoid breaking any consumers and to leverage the newly introduced typegen support, the major version of this package had to be bumped. While you can still use it with older versions of TS, the typegen support in this package requires TS version 4.0 or greater.

When using hooks from `@xstate/react` it's recommended to skip providing explicit generics to them. Note that that generics list has changed since v1 and we now only accept a single generic, `TMachine`.
