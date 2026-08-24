---
title: Input and restored snapshots
description: Start React actors with input or persisted state.
---

`input` gives an actor the data it needs to compute its initial state. `snapshot` restores an actor to a state it already reached. Both are [actor options](../create-actor.md#actor-options), passed as the second argument to the hook.

```tsx
const [snapshot, send] = useActor(uploadMachine, {
  input: { fileName: 'report.pdf' }
});
```

The same options work on `useActorRef` and on a provider.

```tsx
<CheckoutContext.Provider options={{ input: { orderId } }}>
  <Checkout />
</CheckoutContext.Provider>
```

When the logic requires input, the options argument is required and TypeScript reports a missing `input`. See [input and output](../input-output.md).

## Input is read once

Options are read when the actor is created: on the first render of the component, or the first render of the provider. Changing `input` on a later render does not restart the actor and does not update its context.

```tsx
// userId changes on a later render: the actor keeps the original one
const [snapshot] = useActor(profileMachine, { input: { userId } });
```

Two ways to handle changing input, in order of preference:

- Send an event. `send({ type: 'user.changed', userId })` keeps one actor and lets the machine decide what a change means: cancel the in-flight request, reset the form, or keep the draft.
- Remount the component with a `key`. `<Profile key={userId} />` stops the old actor and creates a new one with the new input. Use this when the previous state has no meaning for the new input.

Input itself can be computed at render time, but only the first value is used.

```tsx
const [snapshot] = useActor(searchMachine, {
  input: { query: searchParams.get('q') ?? '' }
});
```

## Restoring a persisted snapshot

Pass a snapshot from [`actor.getPersistedSnapshot()`](../persistence.md) to resume where the user left off. The actor starts in that state rather than its initial state; entry actions are not re-run, and invoked children are restored.

```tsx
import { useActor } from '@xstate/react';

function Checkout({ persisted }: { persisted?: Snapshot<unknown> }) {
  const [snapshot, send] = useActor(checkoutMachine, {
    snapshot: persisted
  });

  return <Step value={snapshot.value} onNext={() => send({ type: 'next' })} />;
}
```

`snapshot: undefined` is the same as passing nothing, so an optional prop or a `localStorage` read that finds nothing needs no branch.

Save as the actor changes by subscribing to the actor reference. `getPersistedSnapshot()` is a method on the actor, not on the snapshot the subscriber receives.

```tsx
const actorRef = useActorRef(checkoutMachine, { snapshot: persisted });

useEffect(() => {
  const sub = actorRef.subscribe(() => {
    localStorage.setItem(
      'checkout',
      JSON.stringify(actorRef.getPersistedSnapshot())
    );
  });

  return () => sub.unsubscribe();
}, [actorRef]);
```

> **Warning:** Stored snapshots are untrusted input. Validate and version them before restoring. A malformed snapshot starts an actor in an unusable state rather than throwing. See [persist and restore actors](../persist-and-restore-actors.md).

`input` and `snapshot` can be passed together, but the restored snapshot already carries the context that input produced. Pass `input` alongside `snapshot` only for logic that reads `input` after restoring.

## TypeScript

`input` is typed from the logic's input schema, and the options argument becomes required when the logic requires input. Restored snapshots are typed as `Snapshot<unknown>` because they come from outside the type system.

```tsx
import type { Snapshot } from 'xstate';

const persisted = JSON.parse(stored) as Snapshot<unknown>;
useActor(checkoutMachine, { snapshot: persisted });
```

## Input and snapshots cheatsheet

```tsx
useActor(logic, { input: { userId } });
useActor(logic, { snapshot: persisted });
useActorRef(logic, { input, snapshot });

<Ctx.Provider options={{ input: { orderId } }} />;

// new input, new actor
<Profile key={userId} />;
```
