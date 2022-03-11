---
'xstate': patch
---

Fixed compatibility of `Interpreter` with older versions of TypeScript. This ensures that our interpreters can correctly be consumed by functions expecting `ActorRef` interface (like for example `useSelector`).
