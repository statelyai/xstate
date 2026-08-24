---
'@xstate/vue': patch
'@xstate/svelte': patch
---

The `send` function returned by `useMachine` (`@xstate/vue`) and `useActor` (`@xstate/svelte`) is now typed as the actor's own `send` signature, matching `actorRef.send`'s overloads.
