---
title: Use a machine in Vue
description: Run XState logic in a Vue component with useActor and useActorRef.
---

```bash
npm install xstate@alpha @xstate/vue@alpha
```

`@xstate/vue` provides four composables: `useActor(...)`, `useActorRef(...)`, `useSelector(...)` and `useMachine(...)`. They require Vue 3.

```vue
<script setup lang="ts">
import { useActor } from '@xstate/vue';
import { createMachine } from 'xstate';

const playerMachine = createMachine({
  context: { volume: 5 },
  initial: 'paused',
  states: {
    paused: { on: { play: { target: 'playing' } } },
    playing: {
      on: {
        pause: { target: 'paused' },
        volume: ({ context, event }) => ({
          context: { ...context, volume: event.level }
        })
      }
    }
  }
});

const { snapshot, send } = useActor(playerMachine);
</script>

<template>
  <button @click="send({ type: 'play' })">Play</button>
  <output>{{ snapshot.value }}</output>
</template>
```

## What useActor returns

| Member | Type | Description |
| --- | --- | --- |
| `snapshot` | `Ref<SnapshotFrom<TLogic>>` | Shallow ref holding the latest [snapshot](../snapshots.md). |
| `send` | `(event) => void` | Sends an event to the actor. |
| `actorRef` | `Actor<TLogic>` | The running actor, for `subscribe(...)`, `getPersistedSnapshot()` or passing to children. |

`snapshot` is a ref, so read `snapshot.value` in script code. Vue unwraps top-level refs in templates, which is why `{{ snapshot.value }}` in a template renders the snapshot's [state value](../states.md), not the ref.

`useActor(...)` accepts any [actor logic](../actor-logic.md): a machine, a promise logic, or a callback logic. It throws in development if it receives an actor reference instead of logic; use `useSelector(actorRef, ...)` for that.

## Options

The second argument is the same [actor options](../create-actor.md) object accepted by `createActor(...)`: `input`, `snapshot`, `id`, `registryKey`, `clock`, `logger`, `inspect`. It is required when the logic requires input.

```ts
const { snapshot, send } = useActor(uploadMachine, {
  input: { fileId },
  registryKey: 'upload'
});
```

Options are read once, when the component sets up. Changing the values later does not restart the actor. Send an event instead.

## Lifecycle

The actor is created during `setup()`, started in `onMounted`, and stopped in `onBeforeUnmount`.

- The initial snapshot is readable before mount, so the first render is never empty.
- Events sent before mount are queued in the actor's mailbox and processed once it starts.
- On unmount the actor is stopped: invoked children stop, delayed transitions are cancelled and further events are ignored.

State does not survive unmount. Persist the snapshot if the actor should resume later. See [Input and restored snapshots](input-and-snapshots.md).

> **Warning:** These composables register lifecycle hooks, so call them synchronously in `setup()` or `<script setup>`. Calling them in an event handler leaves the actor unstarted and unstopped.

## useActorRef

`useActorRef(logic, options?, observerOrListener?)` returns only the actor, with the same lifecycle. No snapshot ref is created, so the component does not re-render on every transition.

```ts
const actorRef = useActorRef(checkoutMachine, { input: { cartId } }, (s) => {
  console.log(s.value);
});
```

The third argument is an observer or a listener function. It is subscribed on mount and unsubscribed on unmount.

Pair it with [`useSelector(...)`](selectors.md) when a component needs one value from a large actor, and with [provide/inject](shared-actors.md) when descendants need the same actor.

## useMachine

`useMachine(machine, options?)` is an alias of `useActor(...)` restricted to machine logic. It returns the same `{ snapshot, send, actorRef }` object. New code can use `useActor(...)` for everything.

## TypeScript

Snapshot, event and input types are inferred from the logic. Type a component prop that carries an actor with `ActorRefFrom`:

```ts
import type { ActorRefFrom } from 'xstate';

const props = defineProps<{
  actorRef: ActorRefFrom<typeof checkoutMachine>;
}>();
```

If the machine requires input, TypeScript requires the options argument with an `input` property.

## Vue composables cheatsheet

```ts
const { snapshot, send, actorRef } = useActor(logic, options);
const actorRef = useActorRef(logic, options, observerOrListener);
const value = useSelector(actorRef, (snapshot) => snapshot.context.value);
const { snapshot, send, actorRef } = useMachine(machine, options); // alias
```
