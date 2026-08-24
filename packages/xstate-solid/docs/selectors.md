---
title: Select actor data
description: Read actor data in Solid with fromActorRef and createMemo.
---

`@xstate/solid` has no `useSelector`. It does not need one: `fromActorRef(...)` returns a deeply reactive snapshot, so reading one property is already a fine-grained subscription. Derive anything further with Solid's `createMemo(...)`.

```tsx
import { createMemo } from 'solid-js';
import { fromActorRef, useActorRef } from '@xstate/solid';

const actorRef = useActorRef(checkoutMachine);
const snapshot = fromActorRef(actorRef);

const total = createMemo(() => snapshot().context.total);

return <output>{total()}</output>;
```

## fromActorRef

`fromActorRef(actorRef)` accepts an actor reference or an accessor of one, and returns an `Accessor` of that actor's snapshot.

| Argument | Description |
| --- | --- |
| `actorRef` | An actor reference, an `Accessor<ActorRef>`, or `undefined`. |

The returned accessor's value is a Solid store built by diffing each new snapshot into the previous one. Only the paths that changed notify their readers, so `snapshot().context.progress` re-runs on progress updates and `snapshot().value` does not.

The diff clones plain objects and arrays. Functions, class instances and other non-plain values are carried over by reference, which is what keeps snapshot methods such as `matches(...)`, `hasTag(...)` and `can(...)` working on the store.

`useActor(...)` uses this internally: its first tuple member is `fromActorRef(actorRef)()`.

## Change detection

There is no `compare` argument, because there is nothing to compare: the store only notifies the paths that changed. A memo over the store adds Solid's own equality check on top.

```ts
const isPaying = createMemo(() => snapshot().matches('paying'));
```

`isPaying()` is `false` for many transitions in a row and only notifies its readers when the boolean flips.

For an object-shaped selection, give the memo an equality function:

```ts
const summary = createMemo(
  () => ({
    step: snapshot().value,
    itemCount: snapshot().context.items.length
  }),
  undefined,
  { equals: (a, b) => a.step === b.step && a.itemCount === b.itemCount }
);
```

## Selecting from child actors

Read a child from `snapshot().children` and pass it to `fromActorRef(...)`.

```tsx
function UploadProgress(props: { parentRef: ActorRefFrom<typeof uploadMachine> }) {
  const parent = fromActorRef(props.parentRef);
  const uploadRef = createMemo(() => parent().children.upload);
  const upload = fromActorRef(uploadRef);

  return <progress value={upload()?.context.progress ?? 0} />;
}
```

Passing an accessor keeps this correct: children come and go with the states that invoke them, and `fromActorRef(...)` re-subscribes whenever the accessor returns a different actor. When the accessor returns `undefined`, the snapshot accessor returns `undefined` too and no subscription is made.

> **Warning:** Destructuring a snapshot (`const { context } = snapshot()`) reads through the store once and loses reactivity. Keep property access inside JSX, memos and effects.

## TypeScript

The snapshot type comes from the actor reference. When the actor may be `undefined`, so is the accessor's value.

```ts
import type { SnapshotFrom } from 'xstate';

const selectTotal = (snapshot: SnapshotFrom<typeof checkoutMachine>) =>
  snapshot.context.total;

const snapshot = fromActorRef(actorRef); // Accessor<SnapshotFrom<...>>
const total = createMemo(() => selectTotal(snapshot()));
```

## Selectors cheatsheet

```ts
const snapshot = fromActorRef(actorRef);
const snapshot = fromActorRef(() => props.actorRef);

const count = createMemo(() => snapshot().context.count);
const isDone = createMemo(() => snapshot().matches('done'));
```
