---
'@xstate/react': patch
---

There will now be a descriptive error when trying to use an actor-like object in the `useService()` hook, where `useActor()` should be preferred:

> Attempted to use an actor-like object instead of a service in the useService() hook. Please use the useActor() hook instead.
