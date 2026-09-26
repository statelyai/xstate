---
'xstate': minor
---

Actors are single-use. Calling `start()` on an actor after `stop()` now throws `Actor <id> was stopped and cannot be restarted. Create a new actor with createActor().` in all builds, instead of silently doing nothing. Calling `start()` on a running actor, or on an actor that already completed or errored, is still a no-op.

```ts
actor.stop();
actor.start(); // throws

const next = createActor(machine).start();
```
