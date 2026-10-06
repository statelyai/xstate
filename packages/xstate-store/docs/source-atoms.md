---
title: Source atoms
description: Share external snapshot subscriptions across atom consumers.
---

Use `createSourceAtom` to expose an external value, such as a media query or a
browser observer, as a read-only atom. Provide `getSnapshot` to read its current
value and `subscribe` to attach a change listener. The listener calls `notify()`;
XState Store reads the latest snapshot. Return a cleanup function from
`subscribe`.

```ts
import { createAtom, createSourceAtom } from '@xstate/store';

const media = window.matchMedia('(prefers-color-scheme: dark)');
const isDark = createSourceAtom({
  getSnapshot: () => media.matches,
  subscribe: (notify) => {
    media.addEventListener('change', notify);
    return () => media.removeEventListener('change', notify);
  }
});
const theme = createAtom(() => (isDark.get() ? 'dark' : 'light'));

// Starts one media query listener, through the derived atom.
const derived = theme.subscribe((value) => console.log(value));
const direct = isDark.subscribe((value) => console.log(value));

// The direct subscriber still needs the listener.
derived.unsubscribe();
// Removes the listener synchronously.
direct.unsubscribe();
```

Create browser sources in an environment where their browser APIs are available.
For server rendering, provide a snapshot reader that works on the server; a plain
read does not attach the external listener.

## Reading and subscribing

Creation is lazy. Calling the source atom's `.get()` without a live consumer reads
`getSnapshot` without calling `subscribe`. Reading an unobserved derived atom also
does not start external subscriptions. Derived atoms cache their values; an
unobserved derived read does not poll external sources for changes.

The first direct subscription, or subscription to a derived atom that reads the
source, starts the listener. Consumers share one listener per source atom instance.
Setup occurs after dependency evaluation settles and before the outer subscription
or update call returns. XState Store attaches the listener before refreshing the
snapshot, including when registration calls `notify()` synchronously.

Like other atoms, subscribing does not emit the initial value. Call `.get()` to
read it. A snapshot change during listener registration can notify subscribers
before `subscribe()` returns.

When a conditional derived atom stops reading the source, its consumer is removed.
The listener remains active while any other direct or indirect consumer needs it.
Cleanup runs after graph updates settle, before the last `unsubscribe()` or update
call returns. Moving a dependency between derived branches during the same update
does not restart a shared listener. Separate unsubscribe/resubscribe calls do.

Subscribing again reconnects the listener and refreshes the snapshot. Notifications
from an earlier, cleaned-up listener are ignored, including after reconnection.

## Snapshot contract

`getSnapshot` should return a stable value until the external source changes, and
`subscribe` should notify whenever that value changes. Reads inside these
callbacks do not establish atom dependencies. Model reactive dependencies in a
derived atom instead.

Snapshots use `Object.is` comparison by default. Provide a custom comparator when
an external source returns a new object for an unchanged value:

```ts
const size = createSourceAtom(
  {
    getSnapshot: () => ({ width: window.innerWidth, height: window.innerHeight }),
    subscribe: (notify) => {
      window.addEventListener('resize', notify);
      return () => window.removeEventListener('resize', notify);
    }
  },
  {
    compare: (previous, next) =>
      previous.width === next.width && previous.height === next.height
  }
);
```

Source atoms expose `.get()` and `.subscribe()`, with no `.set()` or `.send()`.
They do not provide retries or an error state. Synchronous snapshot, registration,
notification, and cleanup errors propagate to the caller. If registration fails
before returning cleanup, the adapter must release any resources it acquired.

Use XState actors when a resource needs commands, retries, reconnection backoff,
or a richer lifecycle. Adapt an actor snapshot with `getSnapshot: () =>
actor.getSnapshot()` and `subscribe: (notify) => { const subscription =
actor.subscribe(notify); return () => subscription.unsubscribe(); }`; the actor's
owner remains responsible for starting and stopping it.
