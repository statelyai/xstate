---
title: "XState Effect: Atoms and React"
description: Read workflow state and send events from an Effect-powered UI.
---

Use `@xstate/effect/atom` to expose an actor through Effect's reactive atoms. The runtime owns the actor; components read its state and send events.

`effect/reactivity` is an unstable Effect module. This entry point follows it and may change independently of the rest of the package.

## Create actor atoms

`createActorAtoms(runtime, logic, options?)` takes an `Atom.runtime` whose Layer provides the logic's services. When the logic requires input, pass `{ input }`; TypeScript rejects missing or mismatched input, just as it does with `createEffectActor`.

This complete example waits for the runtime, sends an approval and reads a selector:

<!-- example from examples/effect-workflows/src/atoms.ts -->

```ts
import { Effect, Layer } from 'effect';
import { AsyncResult, Atom, AtomRegistry } from 'effect/reactivity';
import { waitFor } from '@xstate/effect';
import { createActorAtoms } from '@xstate/effect/atom';
import { createMachine } from 'xstate';

const reviewMachine = createMachine({
  initial: 'pending',
  states: {
    pending: { on: { APPROVE: { target: 'approved' } } },
    approved: {}
  }
});

const runtime = Atom.runtime(Layer.empty);
const review = createActorAtoms(runtime, reviewMachine);
const status = review.select((snapshot) => snapshot.value);
const registry = AtomRegistry.make();
const unmount = registry.mount(status);

export let result: string | undefined;
try {
  const actor = await Effect.runPromise(
    AtomRegistry.getResult(registry, review.actor)
  );
  // Wait for the runtime before sending.
  registry.set(review.send, { type: 'APPROVE' });
  await Effect.runPromise(waitFor(actor, (s) => s.matches('approved')));
  const current = registry.get(status);
  if (AsyncResult.isSuccess(current)) {
    result = current.value;
    console.log(result); // 'approved'
  }
} finally {
  unmount();
  registry.dispose();
}
```

- The actor starts when one of its atoms is first read or mounted.
- It is released when its atoms have no consumers, subject to the registry's idle lifetime.
- Dispose the registry when its owner shuts down.
- A runtime missing a required service is a type error.

## Atom reference

| Atom | Value |
| --- | --- |
| `actor` | `AsyncResult<EffectActor<TLogic>>`. |
| `snapshot` | `AsyncResult<Snapshot>`, including error snapshots. |
| `result` | A failure when the actor errors, suitable for error handling. |
| `send` | Writable atom that accepts an event and reports the last send. |
| `select(f)` | Derived `AsyncResult<T>` from the snapshot. |
| `state` | The snapshot as a [tagged union](matching-states.md). |

The runtime Layer's error type is included in the atoms' error channels. `result` also includes the actor's `ErrorFrom<TLogic>`.

<details>
<summary>Sending before the runtime is ready</summary>

The `send` atom enqueues an event once the actor is ready. Sending while the runtime is still building records `NotReadyError` instead. That class is exported from `@xstate/effect/atom`. Wait for the actor, or render controls after `useAtomSuspense` has resolved.

</details>

## React

Install the React bindings that match your Effect version:

```bash
npm install @effect/atom-react react react-dom
```

The example uses an approval workflow with a demo publishing task. `RegistryProvider` owns the atom registry, and `Suspense` handles startup:

<!-- example from examples/effect-workflows/src/react.tsx -->

```tsx
import { Suspense } from 'react';
import { Effect, Layer } from 'effect';
import { Atom } from 'effect/reactivity';
import {
  RegistryProvider,
  useAtomSet,
  useAtomSuspense
} from '@effect/atom-react';
import { fromEffect, setupEffect } from '@xstate/effect';
import { createActorAtoms } from '@xstate/effect/atom';

const reviewMachine = setupEffect({
  actors: { publish: fromEffect(Effect.sleep('10 millis')) }
}).createMachine({
  initial: 'pending',
  states: {
    pending: { on: { APPROVE: { target: 'publishing' } } },
    publishing: {
      invoke: { src: 'publish', onDone: { target: 'published' } }
    },
    published: {}
  }
});

const runtime = Atom.runtime(Layer.empty);
const review = createActorAtoms(runtime, reviewMachine);
const status = review.select((snapshot) => snapshot.value);

function Review() {
  const { value } = useAtomSuspense(status);
  const send = useAtomSet(review.send);
  return (
    <section>
      <p role="status">{value}</p>
      <button
        disabled={value !== 'pending'}
        onClick={() => send({ type: 'APPROVE' })}
      >
        Approve release
      </button>
    </section>
  );
}

export function App() {
  return (
    <RegistryProvider>
      <Suspense fallback={<p>Starting review…</p>}>
        <Review />
      </Suspense>
    </RegistryProvider>
  );
}
```

- `useAtomSuspense` waits for the runtime and actor, then returns a successful result.
- `useAtomValue` returns the `AsyncResult` directly, for components that render loading and failure states themselves.
- `useAtomMount(review.actor)` lets an owner component retain the actor while child components read selectors.
- Use `Atom.keepAlive` to retain an atom for the registry's lifetime, or `Atom.family` for one actor per input.

<details>
<summary>Starting actors from React hooks</summary>

`useMachine`, `useActor` and `useActorRef` from `@xstate/react` start logic through XState's `createActor`. Start Effect-backed logic in an Effect runtime with `createEffectActor`, then consume it through atoms or `useSelector`.

</details>

## Use an actor handle directly

`useSelector` accepts an `EffectActor`. Build the actor in a `ManagedRuntime`, pass it to a component and dispose the runtime when the application shuts down:

<!-- example from examples/effect-workflows/src/selector.tsx -->

```tsx
import { Context, Layer, ManagedRuntime } from 'effect';
import { createEffectActor, type EffectActor } from '@xstate/effect';
import { useSelector } from '@xstate/react';
import { createMachine } from 'xstate';

const reviewMachine = createMachine({
  initial: 'pending',
  states: {
    pending: { on: { APPROVE: { target: 'approved' } } },
    approved: {}
  }
});

class ReviewActor extends Context.Service<
  ReviewActor,
  EffectActor<typeof reviewMachine>
>()('@app/ReviewActor') {}

export const runtime = ManagedRuntime.make(
  Layer.effect(ReviewActor, createEffectActor(reviewMachine))
);
export const actor = await runtime.runPromise(ReviewActor);

// Render <Review actor={actor} /> in your React application.
export function Review({
  actor
}: {
  actor: EffectActor<typeof reviewMachine>;
}) {
  const status = useSelector(actor, (s) => s.value);
  return (
    <button
      disabled={status !== 'pending'}
      onClick={() => actor.send({ type: 'APPROVE' })}
    >
      {status}
    </button>
  );
}

// Call await runtime.dispose() when the application shuts down.
```

## Required input

Pass the actor's input when creating its atoms:

<!-- example from examples/effect-workflows/src/input-atoms.ts -->

```ts
import { Effect, Layer, Schema } from 'effect';
import { Atom, AtomRegistry } from 'effect/reactivity';
import { fromEffect, join } from '@xstate/effect';
import { createActorAtoms } from '@xstate/effect/atom';

const prepare = fromEffect({
  schemas: { input: Schema.Struct({ release: Schema.String }) },
  effect: ({ input }) => Effect.succeed(`Prepared ${input.release}`)
});

const runtime = Atom.runtime(Layer.empty);
const atoms = createActorAtoms(runtime, prepare, {
  input: { release: 'v1.2.0' }
});
const registry = AtomRegistry.make();
const unmount = registry.mount(atoms.snapshot);

export let result: string | undefined;
try {
  const actor = await Effect.runPromise(
    AtomRegistry.getResult(registry, atoms.actor)
  );
  result = await Effect.runPromise(join(actor));
  console.log(result); // Prepared v1.2.0
} finally {
  unmount();
  registry.dispose();
}
```
