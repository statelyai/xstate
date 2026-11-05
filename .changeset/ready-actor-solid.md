---
'@xstate/solid': minor
---

`useActorRef`, `useActor` and `useMachine` accept an already-created actor, such as one from `restoreActor`. The `snapshot` option is removed; restore the actor with `restoreActor` from `xstate/persist` and pass it to the hook. The hook starts the actor on mount and stops it on unmount, as it does for actors it creates. Create the actor once per component instance.

```tsx
import { useActor } from '@xstate/solid';
import { restoreActor } from 'xstate/persist';

function App(props) {
  const [snapshot, send] = useActor(restoreActor(machine, props.persisted));
  // ...
}
```
