---
title: Server rendering
description: Use XState actors with SolidStart and server-rendered Solid.
---

Solid does not run `onSettled` or effects on the server. `useActorRef(...)` starts the actor in `onSettled`, and `fromActorRef(...)` subscribes in an effect, so during SSR the actor is created but never started: the server renders the initial snapshot, and everything else happens after hydration.

The initial snapshot is therefore what the server output and the first client render must agree on.

## One actor per request

Never keep a running actor in a module that the server imports. On a server the module is shared by every request, so one user's cart, session or upload would be visible to the next.

```ts
// ❌ leaks state between users on the server
export const cartActor = createActor(cartMachine).start();
```

Create the actor inside the component tree and share it with [Solid context](shared-actors.md), which is per-render and therefore per-request. Module-scope actors are for browser-only code.

## Render-only state on the server

When the server needs the state but not a running actor, compute it without creating one.

```ts
import { initialTransition } from 'xstate';

const [snapshot] = initialTransition(checkoutMachine, { cartId });
```

`initialTransition(...)` and `transition(...)` are pure: no effects, no invoked actors, no cleanup. They are the safe way to derive markup on the server, including inside a `"use server"` function.

## Hydrating with a persisted snapshot

To resume the same state in the browser, serialize a persisted snapshot on the server. On the client, create an actor with `restoreActor(...)` and pass it to `useActor(...)`.

```ts
// server
const actor = createActor(checkoutMachine, { input: { cartId } }).start();
const persisted = JSON.parse(JSON.stringify(actor.getPersistedSnapshot()));
actor.stop();
```

Load it with an async memo and derive the actor from it, under a `<Loading>` boundary:

```tsx
import { createMemo, Loading } from 'solid-js';
import { useActor } from '@xstate/solid';
import { restoreActor } from 'xstate/persist';

function Checkout() {
  const persisted = createMemo(() => getPersistedCheckout());
  const [snapshot, send] = useActor(() =>
    restoreActor(checkoutMachine, persisted())
  );

  return (
    <Loading fallback={<p>Loading checkout…</p>}>
      <output>{snapshot.context.total}</output>
    </Loading>
  );
}
```

Until the snapshot loads, the actor is pending and `<Loading>` shows its fallback. The actor is created once the snapshot is available and starts in the browser.

## Avoid hydration mismatches

The server renders the initial or restored snapshot, and the client's first render must match it.

- Do not send events while the component function runs. Send them from `onSettled(...)` or from user interaction.
- Keep `Date.now()`, `Math.random()` and `window` out of the initial context. Pass them as `input`, or set them from an entry action after the actor starts.
- Delayed transitions only run once the actor starts in the browser, so a state entered via `after` is never part of the server output.

> **Warning:** A persisted snapshot that was serialized mid-request restarts its invoked actors on restore. A checkout restored inside `charging` will charge again unless the machine guards against it with an idempotency key.

## Browser-only work

Put browser APIs behind `onSettled(...)`, or invoke them from actor logic. Actors only start on the client, so a [callback actor](../actor-logic.md) that attaches a `resize` or media-element listener never runs on the server.
