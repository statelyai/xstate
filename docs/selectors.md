---
title: Selectors
description: Observe a derived part of an actor's snapshot.
---

`actor.select(selector)` returns a readable that exposes one derived value from the actor's [snapshot](snapshots.md).

```ts
const total = actor.select((snapshot) => snapshot.context.total);

total.get(); // 0

const subscription = total.subscribe((value) => {
  console.log(value);
});

actor.send({ type: 'item.add', price: 10 });
// logs 10

subscription.unsubscribe();
```

A selection has two members:

- `get()` reads the selected value from the current snapshot.
- `subscribe(listener)` notifies only when the selected value changes, and returns a subscription with `unsubscribe()`.

Compare this with `actor.subscribe(...)`, which fires on every snapshot, and `actor.getSnapshot()`, which reads the whole snapshot once with no subscription.

## Change detection

Values are compared with `Object.is` by default. An event that leaves the selection unchanged produces no notification, even though the actor emitted a new snapshot.

```ts
const status = actor.select((snapshot) => snapshot.value);

status.subscribe(render);

actor.send({ type: 'cart.viewed' }); // context changed, value did not
// render is not called
```

Pass an equality function as the second argument when a selector returns a new object each time:

```ts
const summary = actor.select(
  (snapshot) => ({
    step: snapshot.value,
    itemCount: snapshot.context.items.length
  }),
  (a, b) => a.step === b.step && a.itemCount === b.itemCount
);
```

Without that comparison, an object selector notifies on every snapshot because each result is a new reference.

> **Warning:** `subscribe(...)` compares against the value at the time of subscribing. It does not replay the current value, so read `get()` for the initial render.

Use selectors for cases such as:

- rendering upload progress from a machine that also holds file metadata and retry counts
- keeping an imperative view, such as a media element's current time, in sync without re-reading the whole snapshot
- feeding a framework binding that should re-render only when the value it displays changes

Independent selections are independent subscriptions. A machine can drive a progress bar and a status label from one actor while each updates only when its own value changes.

```ts
actor.select((s) => s.context.percent).subscribe(setProgress);
actor.select((s) => s.value).subscribe(setLabel);
```

## TypeScript

The selector argument is typed as `SnapshotFrom<typeof machine>`, and the selection type is inferred from what the selector returns. Annotate the selector when defining it outside the `select(...)` call.

```ts
import type { Readable, SnapshotFrom } from 'xstate';

const selectTotal = (snapshot: SnapshotFrom<typeof checkoutMachine>) =>
  snapshot.context.total;

const total: Readable<number> = actor.select(selectTotal);
```

## Selectors cheatsheet

```ts
const selection = actor.select((snapshot) => snapshot.context.value);

selection.get();
const sub = selection.subscribe((value) => render(value));
sub.unsubscribe();

// custom equality
actor.select(
  (snapshot) => snapshot.context.user,
  (a, b) => a.id === b.id
);
```
