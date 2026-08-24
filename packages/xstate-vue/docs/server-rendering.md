---
title: Server rendering
description: Use XState actors with Nuxt and server-rendered Vue.
---

Server rendering runs `setup()` on the server. `onMounted` does not run there, so an actor created by `useActorRef(...)` or `useActor(...)` is never started during SSR: the server renders the initial snapshot, and the actor starts when the component mounts in the browser.

The initial snapshot is therefore what the server output and the first client render must agree on.

## One actor per request

Never keep a running actor in a module that the server imports. On a server the module is shared by every request, so one user's cart, session or upload would be visible to the next.

```ts
// ❌ leaks state between users on the server
export const cartActor = createActor(cartMachine).start();
```

Create the actor inside the component tree and share it with `provide`/`inject` instead. See [Share actors](shared-actors.md). Module-scope actors are for browser-only code.

## Render-only state on the server

When the server needs the state but not a running actor, compute it without starting anything.

```ts
import { getInitialSnapshot } from 'xstate';

const snapshot = getInitialSnapshot(checkoutMachine, { cartId });
```

`getInitialSnapshot(...)` and `getNextSnapshot(...)` are pure: no effects, no invoked actors, no cleanup. They are the safe way to derive markup on the server.

## Hydrating with a persisted snapshot

To resume the same state in the browser, serialize a persisted snapshot on the server and pass it as the `snapshot` option on the client.

```ts
// server
const actor = createActor(checkoutMachine, { input: { cartId } }).start();
const persisted = actor.getPersistedSnapshot();
actor.stop();
```

In Nuxt, carry it across with `useState(...)`, which is serialized into the payload:

```vue
<script setup lang="ts">
import { useActor } from '@xstate/vue';

const persisted = useState('checkout', () => getPersistedCheckout());

const { snapshot, send } = useActor(checkoutMachine, {
  snapshot: persisted.value
});
</script>
```

The values in the payload must be JSON-serializable, which is the same constraint persistence already imposes.

## Avoid hydration mismatches

The server renders the initial or restored snapshot. The client must render the same thing on its first pass, or Vue will report a mismatch.

- Do not send events during `setup()`. Send them from `onMounted` or from user interaction.
- Keep `Date.now()`, `Math.random()` and `window` out of the initial context. Pass them as `input`, or set them from an entry action after the actor starts.
- Delayed transitions only run once the actor starts in the browser, so a state entered via `after` is never part of the server output.

> **Warning:** A persisted snapshot that was serialized mid-request restarts its invoked actors on restore. A checkout restored inside `charging` will charge again unless the machine guards against it with an idempotency key.

## Browser-only work

Put browser APIs behind `onMounted`, or invoke them from actor logic. Actors only start on the client, so a [callback actor](../actor-logic.md) that attaches a `resize` or media-element listener never runs on the server.
