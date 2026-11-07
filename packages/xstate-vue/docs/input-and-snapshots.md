---
title: Input and restored snapshots
description: Start Vue actors with input or a persisted snapshot.
---

Pass `input` as an actor option for a new actor. To resume a persisted actor,
create it with `restoreActor(...)` from `xstate/persist`, then pass that actor
to `useActor(...)`, `useMachine(...)` or `useActorRef(...)`.

```ts
const { snapshot, send } = useActor(checkoutMachine, { input: { cartId } });

const restored = restoreActor(checkoutMachine, persistedSnapshot);
const resumed = useActor(restored);
```

`input` creates a fresh initial state from data the actor needs when it starts.
`restoreActor` resumes an actor that already ran. Create the actor once per
component instance.

## Input from props

```vue
<script setup lang="ts">
const props = defineProps<{ cartId: string }>();

const { snapshot, send } = useActor(checkoutMachine, {
  input: { cartId: props.cartId }
});
</script>
```

Changing `cartId` later does not restart the actor, because the option was already consumed. Choose one of:

- send an event, such as `send({ type: 'cart.changed', cartId })`, and model the change in the machine
- give the component a `:key="cartId"` so Vue unmounts the old actor and mounts a new one

Machines that declare required [input](../input-output.md) make the options argument mandatory in TypeScript.

## Persisting a snapshot

`actorRef.getPersistedSnapshot()` returns a serializable value, including persisted children. Save it as the actor changes.

```vue
<script setup lang="ts">
import { onBeforeUnmount } from 'vue';
import { useActor } from '@xstate/vue';
import { createActor } from 'xstate';
import { restoreActor } from 'xstate/persist';

const persisted = loadSnapshot();
const actor = persisted
  ? restoreActor(uploadMachine, persisted)
  : createActor(uploadMachine);
const { snapshot, send, actorRef } = useActor(actor);

const subscription = actorRef.subscribe(() => {
  localStorage.setItem(
    'upload',
    JSON.stringify(actorRef.getPersistedSnapshot())
  );
});

onBeforeUnmount(() => subscription.unsubscribe());
</script>
```

Read it back before the actor is created:

```ts
function loadSnapshot() {
  const raw = localStorage.getItem('upload');
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}
```

Stored snapshots are untrusted input. Validate them and fall back to `undefined` when they do not fit the current machine. See [Persist and restore actors](../persist-and-restore-actors.md) for versioning.

Keep machine definitions out of Vue's deep `ref(...)` and `reactive(...)`
wrappers. Store a machine in `shallowRef(machine)` or call `markRaw(machine)`
before putting it in reactive state. This keeps the machine's state nodes raw
when creating or restoring actors:

```ts
import { shallowRef } from 'vue';
import { restoreActor } from 'xstate/persist';

const machineRef = shallowRef(uploadMachine);
const actor = restoreActor(machineRef.value, persisted);
const { snapshot, send } = useActor(actor);
```

## What restoring does

A restored actor starts in the persisted state. Actions that already ran are not re-executed. Invoked actors are restarted and spawned actors are restored recursively, so a machine restored inside `uploading` starts the upload request again.

> **Warning:** Do not persist a snapshot that holds values which cannot survive `JSON.stringify`: DOM nodes, file handles, promises. Keep those out of context, or model them as invoked actors that are recreated on restore.

## Cheatsheet

```ts
useActor(logic, { input });
useActor(restoreActor(logic, persisted));
useActorRef(restoreActor(logic, persisted));

actorRef.getPersistedSnapshot();
```
