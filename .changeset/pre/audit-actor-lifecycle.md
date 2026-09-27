---
"xstate": patch
"@xstate/react": patch
---

Stop child actors and their timers and subscriptions when an unhandled parent error occurs, including when a stop action has not executed yet.

Keep `useActorRef` observers subscribed when the actor is replaced, and subscribe before the replacement starts.
