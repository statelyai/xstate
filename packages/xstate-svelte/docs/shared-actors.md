---
title: Share actors
description: Share one actor through Svelte context.
---

Create the actor once in a parent component and put its reference in Svelte context. Descendants read what they need with [`useSelector(...)`](selectors.md).

## A typed context key

```ts
// checkoutContext.ts
import { getContext, setContext } from 'svelte';
import type { ActorRefFrom } from 'xstate';
import type { checkoutMachine } from './checkoutMachine';

type CheckoutRef = ActorRefFrom<typeof checkoutMachine>;

const key = Symbol('checkout');

export const setCheckout = (actorRef: CheckoutRef) => setContext(key, actorRef);
export const getCheckout = () => getContext<CheckoutRef>(key);
```

Wrapping `setContext`/`getContext` in typed helpers keeps the key private and gives consumers a typed actor without casts.

## Provide the actor

```svelte
<!-- CheckoutProvider.svelte -->
<script lang="ts">
  import { useActorRef } from '@xstate/svelte';
  import { checkoutMachine } from './checkoutMachine';
  import { setCheckout } from './checkoutContext';

  export let cartId: string;

  const actorRef = useActorRef(checkoutMachine, { input: { cartId } });

  setCheckout(actorRef);
</script>

<slot />
```

`useActorRef(...)` is the right choice here: the provider does not render snapshot data, so it should not re-render on every transition.

`setContext` must be called during component initialization, which is also where `useActorRef(...)` has to run, so the two belong together in the script body.

## Read it in a descendant

```svelte
<script lang="ts">
  import { useSelector } from '@xstate/svelte';
  import { getCheckout } from './checkoutContext';

  const checkoutRef = getCheckout();

  const total = useSelector(checkoutRef, (snapshot) => snapshot.context.total);
  const canPay = useSelector(checkoutRef, (snapshot) => snapshot.matches('review'));
</script>

<output>{$total}</output>
<button disabled={!$canPay} on:click={() => checkoutRef.send({ type: 'pay' })}>
  Pay
</button>
```

Every consumer subscribes to the same actor and updates only when its own selection changes.

The actor's lifetime is the provider's lifetime: destroying `CheckoutProvider` stops the actor and everything it invoked. Mount the provider at the level where the state should live: a cart above the checkout routes, or a session actor in the root layout.

## Module-scope actors

An actor created at module scope lives as long as the page, independent of any component.

```ts
// sessionActor.ts
import { createActor } from 'xstate';
import { sessionMachine } from './sessionMachine';

export const sessionActor = createActor(sessionMachine).start();
```

```ts
const user = useSelector(sessionActor, (snapshot) => snapshot.context.user);
```

This suits one global browser-only concern, such as a session or a toast queue. The costs are real: the actor is never stopped, tests share state between cases, and in SvelteKit the module is shared by every server request. Use context for anything scoped to a route, a request or a user. See [Server rendering](server-rendering.md).

## Actor systems

Give a shared actor a `registryKey` so any actor in the [system](../systems.md) can reach it without passing references down the tree.

```ts
const actorRef = useActorRef(checkoutMachine, { registryKey: 'checkout' });
```

```ts
// inside another machine's transition function
({ system }, enq) => {
  enq.sendTo(system.get('checkout'), { type: 'cart.cleared' });
};
```
