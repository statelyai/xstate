---
'xstate': patch
---

Fixed type compatibility with functions accepting machines that were created before typegen was a thing in XState. This should make it possible to use the latest version of XState with `@xstate/vue`, `@xstate/react@^1` and some community packages.

Note that this change doesn't make those functions to accept machines that have typegen information on them. For that the signatures of those functions would have to be adjusted.
