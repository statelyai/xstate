---
title: Select actor data
description: Re-render a component only when selected actor data changes.
---

`useSelector(actorRef, selector, compare?)` reads one derived value from an actor's [snapshot](../snapshots.md) and re-renders the component only when that value changes.

```tsx
import { useActorRef, useSelector } from '@xstate/react';

function Cart() {
  const actorRef = useActorRef(checkoutMachine);
  const total = useSelector(actorRef, (snapshot) => snapshot.context.total);

  return <span>{total}</span>;
}
```

The selector runs on every snapshot. The component re-renders only when the selected value differs from the previous one, compared with `===` by default.

Select the smallest value the component actually renders: a count, a label, or `snapshot.matches('loading')`. Selecting `snapshot.context` re-renders the component on any context change.

```tsx
const isUploading = useSelector(actorRef, (s) => s.matches('uploading'));
const percent = useSelector(actorRef, (s) => s.context.percent);
```

Two selectors on the same actor are independent. A progress bar and a status label can each update only when their own value changes.

## Custom equality

Pass a comparison function as the third argument when the selector returns a new object or array each time. Without it, every snapshot produces a new reference and the component re-renders every time.

```tsx
const summary = useSelector(
  actorRef,
  (s) => ({ step: s.value, itemCount: s.context.items.length }),
  (a, b) => a.step === b.step && a.itemCount === b.itemCount
);
```

`shallowEqual` covers the common case of a flat object or array.

```tsx
import { shallowEqual, useSelector } from '@xstate/react';

const { step, itemCount } = useSelector(
  actorRef,
  (s) => ({ step: s.value, itemCount: s.context.items.length }),
  shallowEqual
);
```

`shallowEqual` compares own enumerable keys one level deep with `Object.is`. It does not recurse, so a selector returning nested objects still re-renders.

## Child actors

`useSelector` works with any actor reference, including [invoked](../invoke.md) and [spawned](../spawn.md) children. Pass the child reference down and let the child component subscribe to it directly, so the parent does not re-render for the child's updates.

```tsx
function TodoList() {
  const [snapshot] = useActor(todosMachine);

  return snapshot.context.todos.map((todo) => (
    <TodoItem key={todo.id} actor={todo} />
  ));
}

type TodoActor = ActorFromLogic<typeof todoMachine>;

function TodoItem({ actor }: { actor: TodoActor }) {
  const label = useSelector(actor, (s) => s.context.label);

  return (
    <button onClick={() => actor.trigger.toggle()}>{label}</button>
  );
}
```

Children read from `snapshot.children` may be absent while their state is inactive. `useSelector` accepts `undefined` as the actor, in which case the selector receives `undefined` and no subscription is made.

```tsx
const progress = useSelector(
  snapshot.children.upload,
  (s) => s?.context.percent ?? 0
);
```

If the selected actor is in an `error` snapshot, `useSelector` throws the error during render so an error boundary can catch it.

## Compared with `actor.select`

[`actor.select(...)`](../selectors.md) is the framework-agnostic API. It returns a readable with `get()` and `subscribe(...)`, and is the API to use outside components: in machine logic, tests, or imperative code that syncs a media element.

Inside a component, use `useSelector`. It handles subscription, cleanup and concurrent rendering through `useSyncExternalStore`.

## TypeScript

The selector's argument is typed from the actor reference's snapshot, and the return type is inferred from the selector. Annotate the parameter when the selector is defined outside the call.

```tsx
import type { SnapshotFrom } from 'xstate';

const selectTotal = (snapshot: SnapshotFrom<typeof checkoutMachine>) =>
  snapshot.context.total;

const total = useSelector(actorRef, selectTotal); // number
```

## Selectors cheatsheet

```tsx
useSelector(actorRef, (snapshot) => snapshot.context.count);
useSelector(actorRef, (snapshot) => snapshot.matches('loading'));
useSelector(actorRef, selector, compare);
useSelector(actorRef, selector, shallowEqual);
useSelector(snapshot.children.upload, (s) => s?.context.percent ?? 0);
```
