---
'@xstate/svelte': minor
---

`useActorRef`, `useActor` and `useMachine` accept an already-created actor, such as one from `restoreActor`. The `snapshot` option is removed; restore the actor with `restoreActor` from `xstate/persist` and pass it to the hook. The hook starts the actor and stops it when the component is destroyed, as it does for actors it creates. Create the actor once per component instance.

```svelte
<script lang="ts">
  import { useActor } from '@xstate/svelte';
  import { restoreActor } from 'xstate/persist';

  const { snapshot, send } = useActor(restoreActor(machine, persisted));
</script>
```
