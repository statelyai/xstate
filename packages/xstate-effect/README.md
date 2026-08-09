# `@xstate/effect`

Effect-native actor logic and scoped runners for XState v6.

## Install

<!-- install command matching package.json peerDependencies -->

```bash
pnpm add @xstate/effect@alpha xstate@alpha effect@4.0.0-beta.105
```

## API

<!-- exported functions from src/index.ts -->

- `fromEffect(...)`
- `spawnActor(...)`
- `runActor(...)`

The integration executes Effect programs as Fibers without converting them to
promises. XState remains responsible for actor and statechart semantics;
Effect owns services, Fibers, scopes, finalizers, and typed failures.

```ts
import { Context, Effect, Layer } from 'effect';
import { fromEffect, runActor, type EffectActorArgs } from '@xstate/effect';

const Users = Context.Service<{ get: (id: string) => string }>('Users');

const loadUser = fromEffect(({ input }: EffectActorArgs<{ id: string }>) =>
  Effect.gen(function* () {
    const users = yield* Users;
    return users.get(input.id);
  })
);

const program = runActor(loadUser, {
  input: { id: '42' },
  inspect: (event) => console.log(event)
}).pipe(
  Effect.provide(
    Layer.succeed(Users, {
      get: (id) => `user:${id}`
    })
  )
);
```

`runActor(...)` exposes the Effect actor's success, checked-error, and service
channels. `spawnActor(...)` returns a scoped XState actor for interactive use.
Closing the Effect scope stops the XState actor, interrupts its Fibers, and
waits for their finalizers.
