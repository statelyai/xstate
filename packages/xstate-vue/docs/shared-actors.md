---
title: Share actors
description: Provide one actor to Vue descendants with provide and inject.
---

Create the actor once in a parent component, then share the reference with Vue's `provide` and `inject`. Descendants read what they need with [`useSelector(...)`](selectors.md).

`@xstate/vue` has no `createActorContext`. Vue's `provide` and `inject` already form a typed registry scoped to the component tree, so a shared actor is an actor reference passed through them. Pinia shares stores the same way.

## A typed injection key

```ts
// checkoutKey.ts
import type { InjectionKey } from 'vue';
import type { ActorRefFrom } from 'xstate';
import { checkoutMachine } from './checkoutMachine';

export const checkoutKey: InjectionKey<ActorRefFrom<typeof checkoutMachine>> =
  Symbol('checkout');
```

An `InjectionKey<T>` carries the actor type, so `inject(checkoutKey)` is typed without casts.

## Provide the actor

```vue
<!-- CheckoutProvider.vue -->
<script setup lang="ts">
import { provide } from 'vue';
import { useActorRef } from '@xstate/vue';
import { checkoutMachine } from './checkoutMachine';
import { checkoutKey } from './checkoutKey';

const props = defineProps<{ cartId: string }>();

const actorRef = useActorRef(checkoutMachine, { input: { cartId: props.cartId } });

provide(checkoutKey, actorRef);
</script>

<template><slot /></template>
```

`useActorRef(...)` is the right composable here: the provider itself does not render snapshot data, so it should not re-render on every transition.

## Inject it

```vue
<script setup lang="ts">
import { inject } from 'vue';
import { useSelector } from '@xstate/vue';
import { checkoutKey } from './checkoutKey';

const checkoutRef = inject(checkoutKey)!;
const total = useSelector(checkoutRef, (snapshot) => snapshot.context.total);
const canPay = useSelector(checkoutRef, (snapshot) => snapshot.matches('review'));
</script>

<template>
  <output>{{ total }}</output>
  <button :disabled="!canPay" @click="checkoutRef.send({ type: 'pay' })">
    Pay
  </button>
</template>
```

Every consumer subscribes to the same actor and re-renders only when its own selection changes.

The actor's lifetime is the provider's lifetime: unmounting `CheckoutProvider` stops the actor and everything it invoked. Mount the provider at the level where the state should live: a cart above the checkout routes, or a session actor above the whole app shell.

## Create the actor yourself

A provider can create the actor with `createActor(...)` instead of `useActorRef(...)`. The provider then owns the actor's lifecycle: start it in `setup`, and stop it in `onUnmounted`.

```vue
<!-- CheckoutProvider.vue -->
<script setup lang="ts">
import { onUnmounted, provide } from 'vue';
import { createActor } from 'xstate';
import { checkoutMachine } from './checkoutMachine';
import { checkoutKey } from './checkoutKey';

const props = defineProps<{ cartId: string }>();

const actorRef = createActor(checkoutMachine, {
  input: { cartId: props.cartId }
}).start();

provide(checkoutKey, actorRef);

onUnmounted(() => {
  actorRef.stop();
});
</script>

<template><slot /></template>
```

The actor is running before any descendant's `setup` runs. `useActorRef(...)` starts its actor in `onMounted`, which runs after the descendants have mounted.

## Module-scope actors

An actor created at module scope lives for the lifetime of the page, independent of any component.

```ts
// sessionActor.ts
import { createActor } from 'xstate';
import { sessionMachine } from './sessionMachine';

export const sessionActor = createActor(sessionMachine).start();
```

```ts
const user = useSelector(sessionActor, (snapshot) => snapshot.context.user);
```

To keep components from importing the actor module, provide it on the app with a typed key. Every component in the app can then `inject(sessionKey)`.

```ts
// main.ts
import { createApp } from 'vue';
import App from './App.vue';
import { sessionActor } from './sessionActor';
import { sessionKey } from './sessionKey';

const app = createApp(App);

app.provide(sessionKey, sessionActor);
app.onUnmount(() => {
  sessionActor.stop();
});

app.mount('#app');
```

`app.onUnmount(...)` requires Vue 3.5 or later.

This suits one global concern per app, such as a session or a toast queue. It has real costs: the actor is never stopped, tests share state between cases, and on a server the module is shared by every request. Use `provide`/`inject` for anything scoped to a route, a request or a user. See [Server rendering](server-rendering.md).

## Actor systems

Give a shared actor a `registryKey` so any actor in the [system](../systems.md) can reach it without prop drilling.

```ts
const actorRef = useActorRef(checkoutMachine, { registryKey: 'checkout' });
```

```ts
// inside another machine's transition function
({ system }, enq) => {
  enq.sendTo(system.get('checkout'), { type: 'cart.cleared' });
};
```
