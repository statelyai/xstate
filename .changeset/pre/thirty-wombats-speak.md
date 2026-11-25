---
'@xstate/vue': minor
---

Keep shared actors running until their owning Vue effect scope is disposed. With VueUse's `createSharedComposable`, unmounting one consumer no longer stops an actor still used by another consumer. The last consumer's disposal stops the actor, and a later consumer gets a fresh actor.

```ts
const useCheckout = createSharedComposable(() => useMachine(checkoutMachine));
```

Vue 3.2 or later is now required. Actors still start when the first consumer mounts and remain unstarted during server rendering.
