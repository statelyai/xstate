---
title: Server rendering
description: Render XState actors on the server and hydrate them on the client.
---

Two rules cover most cases: never share a running actor between requests, and make the first client render produce the same markup the server produced.

`useActor`, `useActorRef` and `useSelector` all render on the server. They create the actor, read its initial snapshot and return it. The effect that starts the actor never runs, so no transitions, entry actions or invoked children execute on the server.

## One actor per request

A module-scope actor is created once per process and shared by every request, so one user's checkout state is rendered into another user's page. Create actors inside the request or inside the component tree instead.

```tsx
// Wrong on the server: one actor for every visitor
export const cartActor = createActor(cartMachine).start();
```

```tsx
// Right: one actor per rendered tree
<CartContext.Provider options={{ input: { userId } }}>
  <App />
</CartContext.Provider>
```

The same applies to actors created in a request handler: stop them when the request finishes, or let them go out of scope. See [run backend workflows](../backend-workflows.md).

> **Warning:** [Module-scope actors](global-state.md) are a client-only pattern. In a server-rendered app, put the module that creates them behind a client entry point so it never loads during a request.

## Render-only initial state

When the server only needs to render markup and will not run the machine, `getInitialSnapshot(logic, input?)` computes the initial snapshot without creating an actor.

```tsx
import { getInitialSnapshot } from 'xstate';

const snapshot = getInitialSnapshot(checkoutMachine, { orderId });
const heading = snapshot.matches('review') ? 'Review order' : 'Checkout';
```

This is the cheapest option for a route that renders a heading, a title or a redirect decision from the machine's initial state.

## Hydration with a persisted snapshot

When the server advanced the machine (loading data, validating a session, resuming a saved flow), serialize the result and restore it on the client so the first client render matches.

On the server, run the actor and take a persisted snapshot:

```tsx
const actor = createActor(checkoutMachine, { input: { orderId } }).start();
await waitFor(actor, (snapshot) => snapshot.matches('ready'));

const persisted = actor.getPersistedSnapshot();
actor.stop();
```

Send `persisted` to the client with the page, then pass it to the hook:

```tsx
function Checkout({ persisted }: { persisted: Snapshot<unknown> }) {
  const [snapshot, send] = useActor(checkoutMachine, { snapshot: persisted });

  return <Step value={snapshot.value} onNext={() => send({ type: 'next' })} />;
}
```

Both renders now start from the same snapshot, so there is no hydration mismatch. See [input and snapshots](input-and-snapshots.md) and [persistence](../persistence.md).

Anything in context must survive `JSON.stringify`. Store an id and look the resource up again on the client rather than putting a client, socket or DOM node in context. See [serialization](../serialization.md).

## Next.js App Router

Hooks are client-only. A component that calls `useActor`, `useActorRef` or `useSelector` needs `'use client'`, as does the module that calls `createActorContext(...)`.

```tsx
'use client';

import { createActorContext } from '@xstate/react';

export const CheckoutContext = createActorContext(checkoutMachine);
```

Server components can still do machine work, such as computing a snapshot with `getInitialSnapshot(...)` or running an actor to completion, and pass the result down as a serializable prop:

```tsx
// app/checkout/page.tsx — server component
export default async function Page({ params }) {
  const persisted = await loadCheckoutSnapshot(params.orderId);

  return (
    <CheckoutContext.Provider options={{ snapshot: persisted }}>
      <CheckoutSteps />
    </CheckoutContext.Provider>
  );
}
```

Only serializable values cross that boundary, which is what `getPersistedSnapshot()` returns.

## Browser-only effects

Effects that touch `window`, `localStorage` or media APIs must not run during a server render. Nothing in a machine runs on the server, so put them where they belong: in an [invoked actor](../invoke.md) owned by a state the machine only reaches after hydration, or in an effect queued with `enq(...)`, which is executed by a started actor and therefore only in the browser.
