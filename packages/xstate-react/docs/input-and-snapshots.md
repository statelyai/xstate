---
title: Input and restored snapshots
description: Start React actors with input or persisted state.
---

`input` gives an actor the data it needs to compute its initial state. Pass it in the [actor options](../create-actor.md#actor-options) as the second argument to the hook.

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

When the logic requires input, TypeScript requires an `input` value. If the input may be missing, check it before rendering the component that creates the actor. See [input and output](../input-output.md).

```tsx
function CheckoutRoute({ orderId }: { orderId: string | undefined }) {
  return orderId === undefined ? null : <Checkout orderId={orderId} />;
}
```

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

Pass a snapshot from [`actor.getPersistedSnapshot()`](../persistence.md) to `restoreActor()`. Create the restored actor once and pass it to the hook. The actor resumes from the persisted state without rerunning entry actions. Invoked children are restored.

```tsx
import { useActor } from '@xstate/react';
import { useState } from 'react';
import { createActor, type PersistedSnapshotFrom } from 'xstate';
import { restoreActor } from 'xstate/persist';

function Checkout({
  orderId,
  persisted
}: {
  orderId: string;
  persisted?: PersistedSnapshotFrom<typeof checkoutMachine>;
}) {
  const [actor] = useState(() =>
    persisted
      ? restoreActor(checkoutMachine, persisted)
      : createActor(checkoutMachine, { input: { orderId } })
  );
  const [snapshot, send] = useActor(actor);

  return <Step value={snapshot.value} onNext={() => send({ type: 'next' })} />;
}
```

If the persisted snapshot is missing, create a new actor with the required input.

Save as the actor changes by subscribing to the actor reference. `getPersistedSnapshot()` is a method on the actor, not on the snapshot the subscriber receives.

```tsx
const actorRef = useActorRef(actor);

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

> **Warning:** Stored snapshots are untrusted input. Validate and version them before restoring. If restoration fails, the actor's snapshot has `status: 'error'`. `useActor` and `useSelector` throw the error during render. To recover, use an error boundary whose fallback can discard the stored snapshot and remount the component with the required input. See [persist and restore actors](../persist-and-restore-actors.md).

## Input and snapshots cheatsheet

```tsx
useActor(logic, { input: { userId } });
const [actor] = useState(() => restoreActor(logic, persisted));
useActor(actor);
useActorRef(actor);

<Ctx.Provider options={{ input: { orderId } }} />;

// new input, new actor
<Profile key={userId} />;
```
