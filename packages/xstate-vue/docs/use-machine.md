---
title: Use a machine in Vue
description: Run XState logic in a Vue component.
---

```bash
npm install xstate@alpha @xstate/vue@alpha
```

```vue
<script setup lang="ts">
import { useActor } from '@xstate/vue';
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

<template>
  <button @click="send({ type: 'toggle' })">{{ snapshot.value }}</button>
</template>
```

Use `useActorRef(...)` when the component does not need every snapshot.

Use `useActor(...)` for UI driven by the whole snapshot, such as a wizard step or request status. Use `useActorRef(...)` with `useSelector(...)` for a shared cart or session actor when a component only needs one value.

## TypeScript

The composable infers snapshot and event types from the actor logic.

## Vue composables cheatsheet

```ts
const { snapshot, send, actorRef } = useActor(logic, options);
const actorRef = useActorRef(logic, options);
```
