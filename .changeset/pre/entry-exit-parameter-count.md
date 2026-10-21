---
'xstate': patch
---

Entry and exit functions now behave the same in more cases, whatever the number of parameters they declare:

- An entry or exit function declared with one parameter receives `guards` and `delays`, as one declared with `(args, enq)` already did. Calling a named guard from it no longer throws.
- When the machine reaches its top-level final state, the exit functions of the states still active run. The `context` returned by one declared with `(args, enq)` is now applied, as it already was for other exit functions.
- An exit function declared with `(args, enq)` receives the current `children`, without the invoked children of the states exited before it.
- Only entry and exit functions declared with exactly two parameters get a working `enq`. Development builds now warn when any other entry or exit function calls `enq`, because the call is ignored. This catches wrappers that forward `(...args)` and an `enq` parameter with a default value.
