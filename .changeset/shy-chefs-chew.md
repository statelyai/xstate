---
'@xstate/inspect': patch
---

Fixed an issue with "maximum call stack size exceeded" errors being thrown when registering a machine with a very deep object in its context despite using a serializer capable of replacing such an object.
