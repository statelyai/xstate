---
title: Use a machine in Svelte
description: Run XState logic in a Svelte component.
---

```bash
npm install xstate@alpha @xstate/svelte@alpha
```

```svelte
<script lang="ts">
  import { useActor } from '@xstate/svelte';
  import { createMachine } from 'xstate';

  const machine = createMachine({
    initial: 'inactive',
    states: {
      inactive: { on: { toggle: { target: 'active' } } },
      active: { on: { toggle: { target: 'inactive' } } }
    }
  });

  const { snapshot, send } = useActor(machine);
</script>

<button on:click={() => send({ type: 'toggle' })}>{$snapshot.value}</button>
```

## TypeScript

The helper infers snapshot and event types from the actor logic.

## Svelte helpers cheatsheet

```ts
const { snapshot, send, actorRef } = useActor(logic, options);
const actorRef = useActorRef(logic, options);
```
