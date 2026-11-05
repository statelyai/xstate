---
'@xstate/vue': minor
---

`useActorRef`, `useActor` and `useMachine` accept an already-created actor, such as one from `restoreActor`. The `snapshot` option is removed; restore the actor with `restoreActor` from `xstate/persist` and pass it to the hook. The hook starts the actor on mount and stops it on unmount, as it does for actors it creates. Create the actor once per component instance.

```ts
import { useActor } from '@xstate/vue';
import { restoreActor } from 'xstate/persist';

// in setup()
const { snapshot, send } = useActor(restoreActor(machine, persisted));
```
