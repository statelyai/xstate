---
title: Server rendering
description: Use XState actors with SvelteKit and server-rendered Svelte.
---

In SvelteKit, a component's script body runs on the server as well as in the browser. `useActorRef(...)` starts the actor as soon as it is called, so during SSR the actor does start: entry actions run, invoked actors are created, and the actor is stopped again when Svelte calls `onDestroy` at the end of the server render.

That is acceptable for pure state, but not for effects. Decide per machine which of the two approaches below applies.

## Render-only state on the server

When the server needs the state but not a running actor, compute it without starting anything.

```ts
import { getInitialSnapshot } from 'xstate';

const snapshot = getInitialSnapshot(checkoutMachine, { cartId });
```

`getInitialSnapshot(...)` and `getNextSnapshot(...)` are pure: no effects, no invoked actors, no cleanup. They are the safe way to derive markup on the server.

## Keep effects out of the server pass

If the component must create a real actor, keep browser-only work behind a check.

```svelte
<script lang="ts">
  import { browser } from '$app/environment';
  import { onMount } from 'svelte';

  const { snapshot, send } = useActor(playerMachine);

  onMount(() => send({ type: 'ready' }));
</script>
```

`onMount` never runs on the server, so anything sent from it is browser-only. Inside the machine, put DOM and network work in invoked [callback or async actors](../actor-logic.md) belonging to states the machine only reaches after such an event.

## One actor per request

Never keep a running actor in a module that the server imports. On a server the module is shared by every request, so one user's cart, session or upload would be visible to the next.

```ts
// ❌ leaks state between users on the server
export const cartActor = createActor(cartMachine).start();
```

Create the actor in a component and share it through [Svelte context](shared-actors.md), which is per-render and therefore per-request. Module-scope actors are for browser-only code.

## Hydrating with a persisted snapshot

To resume the same state in the browser, serialize a persisted snapshot in a `load` function and pass it as the `snapshot` option.

```ts
// +page.server.ts
import { createActor } from 'xstate';

export const load = async ({ params }) => {
  const actor = createActor(checkoutMachine, {
    input: { cartId: params.cartId }
  }).start();
  const snapshot = JSON.parse(JSON.stringify(actor.getPersistedSnapshot()));
  actor.stop();
  return { snapshot };
};
```

```svelte
<!-- +page.svelte -->
<script lang="ts">
  export let data;

  const { snapshot, send } = useActor(checkoutMachine, {
    snapshot: data.snapshot
  });
</script>
```

Everything returned from `load` must be serializable, which is the same constraint persistence already imposes.

## Avoid hydration mismatches

The server renders the initial or restored snapshot, and the client's first render must match it.

- Do not send events during component initialization. Send them from `onMount` or from user interaction.
- Keep `Date.now()`, `Math.random()` and `window` out of the initial context. Pass them as `input`, or set them from an entry action after the actor starts.
- Delayed transitions scheduled with `after` fire on the client's clock, so a state entered via a delay is never part of the server output.

> **Warning:** A persisted snapshot that was serialized mid-request restarts its invoked actors on restore. A checkout restored inside `charging` will charge again unless the machine guards against it with an idempotency key.
