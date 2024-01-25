---
'@xstate/react': minor
---

`useSelector` now also allows actor.system to be passed in. This works exactly how normally passing an actor would, any changes that cause the selector to change will be automatically up to date.

ex:

```tsx
const deepChildC = useSelector(actorRef.system, (system) => system.actors.c);
```
