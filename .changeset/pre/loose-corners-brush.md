---
"@xstate/effect": patch
"xstate": patch
---

Infer the current service requirements of actions and actors replaced with `machine.provide`. Require declared actor input in `createActorAtoms`, consistently with `createEffectActor`.

Effect tasks and streams now release their resources when they complete, fail or are cancelled. Actor shutdown waits for task cleanup before releasing resources shared for the actor's lifetime. Use `withActorScope` around an acquisition to keep its resource until the owning Effect actor stops:

```ts
import { Effect } from 'effect';
import { withActorScope } from '@xstate/effect';

const session = Effect.acquireRelease(
  Effect.succeed({ id: 'session' }),
  () => Effect.log('Session closed')
).pipe(withActorScope);
```

Improve XState Effect guides with complete, tested workflow, stream, inspection and React examples.
