---
title: Share actors
description: Share one actor through Solid context.
---

Create the actor once in a provider component, then share the reference with Solid's `createContext`. Descendants read what they need with [`fromActorRef(...)`](selectors.md).

## A typed context

```tsx
// checkoutContext.tsx
import { createContext, useContext, type ParentProps } from 'solid-js';
import { useActorRef } from '@xstate/solid';
import type { ActorRefFrom } from 'xstate';
import { checkoutMachine } from './checkoutMachine';

const CheckoutContext = createContext<ActorRefFrom<typeof checkoutMachine>>();

export function CheckoutProvider(props: ParentProps<{ cartId: string }>) {
  const actorRef = useActorRef(checkoutMachine, {
    input: { cartId: props.cartId }
  });

  return (
    <CheckoutContext.Provider value={actorRef}>
      {props.children}
    </CheckoutContext.Provider>
  );
}

export function useCheckout() {
  const actorRef = useContext(CheckoutContext);
  if (!actorRef) throw new Error('useCheckout must be used inside CheckoutProvider');
  return actorRef;
}
```

`createContext<T>()` without a default value gives `useContext(...)` the type `T | undefined`. Throwing in the hook narrows it once, so no consumer needs a non-null assertion.

`useActorRef(...)` is the right primitive here: the provider renders no snapshot data, so it should not depend on the actor's transitions.

## Read it in a descendant

```tsx
import { createMemo, Show } from 'solid-js';
import { fromActorRef } from '@xstate/solid';
import { useCheckout } from './checkoutContext';

export function PayButton() {
  const checkoutRef = useCheckout();
  const snapshot = fromActorRef(checkoutRef);
  const canPay = createMemo(() => snapshot().matches('review'));

  return (
    <>
      <output>{snapshot().context.total}</output>
      <Show when={canPay()}>
        <button onClick={() => checkoutRef.send({ type: 'pay' })}>Pay</button>
      </Show>
    </>
  );
}
```

Each consumer subscribes to the same actor, and Solid's fine-grained updates mean only the expressions that read a changed value re-run.

The actor's lifetime is the provider's lifetime: unmounting `CheckoutProvider` stops the actor and everything it invoked. Mount the provider at the level where the state should live: a cart above the checkout routes, or a session actor above the whole app shell.

## Module-scope actors

An actor created at module scope lives for the lifetime of the page, independent of any component.

```ts
// sessionActor.ts
import { createActor } from 'xstate';
import { sessionMachine } from './sessionMachine';

export const sessionActor = createActor(sessionMachine).start();
```

```tsx
const session = fromActorRef(sessionActor);
```

This suits one global browser-only concern, such as a session or a toast queue. The costs are real: the actor is never stopped, tests share state between cases, and in SolidStart the module is shared by every server request. Use context for anything scoped to a route, a request or a user. See [Server rendering](server-rendering.md).

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
