---
title: Atoms and React
description: Expose an Effect-backed actor to a reactive UI.
---

`@xstate/effect/atom` exposes an actor through `effect/unstable/reactivity`, so a reactive UI reads it the way it reads any other Effect state.

`effect/unstable/reactivity` is an unstable Effect module. This entry point follows it and may change independently of the rest of the package.

## `createActorAtoms`

`createActorAtoms(runtime, logic, options?)` takes an `Atom.runtime` whose Layer provides the logic's services, and returns:

| Atom | Type |
| --- | --- |
| `actor` | `Atom<AsyncResult<EffectActor<TLogic>>>` |
| `snapshot` | `Atom<AsyncResult<Snapshot>>` |
| `result` | `Atom<AsyncResult<Snapshot, ErrorFrom<TLogic>>>`, a `Failure` once the actor errors |
| `send` | `Writable<AsyncResult<void, NotReadyError>, Event>`, set it with an event |
| `select(f)` | `Atom<AsyncResult<T>>` derived from `snapshot` |
| `state` | `Atom<AsyncResult<TaggedState>>`, the snapshot as a [tagged union](matching-states.md) |

```ts
import { Effect, Layer } from 'effect';
import { Atom, AtomRegistry, AsyncResult } from 'effect/unstable/reactivity';
import { createActorAtoms } from '@xstate/effect/atom';

const runtime = Atom.runtime(
  Layer.succeed(Api, { fetchUser: (id: string) => Effect.succeed({ id }) })
);
const user = createActorAtoms(runtime, machine);
const status = user.select((snapshot) => snapshot.value);

const registry = AtomRegistry.make();
registry.subscribe(
  status,
  (result) => {
    if (AsyncResult.isSuccess(result)) {
      console.log(result.value);
    }
  },
  { immediate: true }
);
registry.set(user.send, { type: 'RETRY' });
```

The actor starts when one of its atoms is first read and stops when nothing reads or mounts them anymore. Values are `AsyncResult` because the runtime's Layer builds asynchronously.

A runtime that does not provide a service the logic requires is a type error on the `runtime` argument.

### `send` and `NotReadyError`

The `send` atom enqueues the event, like `actor.send`. Its value reports the last send. Setting it before the runtime has finished building records a `NotReadyError` failure instead of sending, and `NotReadyError` is exported from `@xstate/effect/atom`.

### `result`

`result` is `snapshot` with an errored actor reported as a `Failure` carrying the actor's error, which is what an error boundary needs. `snapshot` keeps reporting the error snapshot as a success.

### Keeping the actor alive

Wrap an atom with `Atom.keepAlive` to keep the actor for the registry's lifetime. Build the atoms inside `Atom.family` to get one actor per input.

```ts
const userAtoms = Atom.family((id: string) =>
  createActorAtoms(runtime, userMachine, { input: { id } }).snapshot
);
```

## React

`useMachine`, `useActor` and `useActorRef` from `@xstate/react` call `createActor` internally, so they cannot start Effect-backed logic. In an Effect application the actor lives in the runtime and React reads it through atoms, with the hooks from `@effect/atom-react`.

```tsx
import { Suspense } from 'react';
import { Atom } from 'effect/unstable/reactivity';
import { useAtomSet, useAtomSuspense } from '@effect/atom-react';
import { createActorAtoms } from '@xstate/effect/atom';

const runtime = Atom.runtime(AppLayer);
const checkout = createActorAtoms(runtime, checkoutMachine);
const status = checkout.select((snapshot) => snapshot.value);

function Checkout() {
  const { value } = useAtomSuspense(status);
  const send = useAtomSet(checkout.send);

  return <button onClick={() => send({ type: 'PAY' })}>{String(value)}</button>;
}

export function App() {
  return (
    <Suspense fallback={null}>
      <Checkout />
    </Suspense>
  );
}
```

`useAtomSuspense` suspends until the runtime and the actor are ready. `useAtomValue` returns the `AsyncResult` instead, for components that render their own loading state.

The actor starts when the first component reads one of its atoms and stops when the last one unmounts. An owner component can hold it with `useAtomMount(checkout.actor)` while children read selectors. Pin it with `Atom.keepAlive` when it must outlive the components.

### Without atoms

The `EffectActor` handle is an XState actor reference, so `useSelector` from `@xstate/react` reads it directly. Create the actor through a `ManagedRuntime`, pass the handle down, and call `actor.send` as usual.

```tsx
import { useSelector } from '@xstate/react';

function Total({ actor }: { actor: EffectActor<typeof checkoutMachine> }) {
  const total = useSelector(actor, (snapshot) => snapshot.context.total);

  return <button onClick={() => actor.send({ type: 'PAY' })}>{total}</button>;
}
```
