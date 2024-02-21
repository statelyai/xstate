---
'@xstate/solid': minor
---

The `useActor` hook accepts an actor `logic` now and not an existing `actorRef`. It's used to creating a new instance of an actor and it works just like `useMachine` used to work (`useMachine` is now just an alias of `useActor`).
