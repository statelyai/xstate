---
title: Share actors
description: Provide one actor to a React subtree.
---

`createActorContext(logic, options?)` builds a React context around actor logic. Every component under the provider reads and sends to the same actor.

```tsx
import { createActorContext } from '@xstate/react';

export const CheckoutContext = createActorContext(checkoutMachine);

function App() {
  return (
    <CheckoutContext.Provider>
      <Cart />
      <PaymentStep />
    </CheckoutContext.Provider>
  );
}

function Cart() {
  const total = CheckoutContext.useSelector((snapshot) => snapshot.context.total);
  const actorRef = CheckoutContext.useActorRef();

  return <button onClick={() => actorRef.trigger.pay()}>Pay {total}</button>;
}
```

The returned object has three members.

| Member | Description |
| --- | --- |
| `Provider` | Creates one actor and provides it to its subtree. |
| `useSelector(selector, compare?)` | Reads a derived value from the provided actor. Same semantics as [`useSelector`](selectors.md). |
| `useActorRef()` | Returns the provided [actor reference](../create-actor.md). Does not re-render. |

Each rendered `Provider` creates its own actor, with the same lifecycle as [`useActorRef`](use-machine.md#actor-lifecycle): started on mount, stopped on unmount, recreated if it was stopped while the component stayed mounted.

Calling `useSelector` or `useActorRef` outside the provider throws: *You used a hook from "ActorProvider" but it's not inside a `<ActorProvider>` component.*

## Provider options

`Provider` takes an `options` prop with the same [actor options](../create-actor.md#actor-options) as `createActor(...)`: `input`, `snapshot`, `id`, `inspect`, and the rest.

```tsx
<CheckoutContext.Provider options={{ input: { orderId } }}>
  <Checkout />
</CheckoutContext.Provider>
```

Options passed to `createActorContext(logic, options)` are defaults. The `options` prop is merged over them, key by key.

```tsx
const CheckoutContext = createActorContext(checkoutMachine, {
  inspect: inspector
});

// inspect is kept, input is added
<CheckoutContext.Provider options={{ input: { orderId } }} />;
```

`logic` overrides the logic for one provider, which is how a test swaps in [`machine.provide({ ... })`](../setup-and-provide.md).

```tsx
<CheckoutContext.Provider
  logic={checkoutMachine.provide({ actors: { authorize: fakeAuthorize } })}
>
  <Checkout />
</CheckoutContext.Provider>
```

> **Warning:** The `machine` prop was removed. Passing it throws. Use `logic`.

## When to use it

Use a provider when several components in one subtree need the same actor and the actor's lifetime matches a piece of the UI: a cart shared across checkout steps, a wizard shared across its steps, a media player shared by transport controls and a timeline.

Prefer passing the actor reference as a prop when only one or two components need it. `useActorRef` in a parent plus [`useSelector`](selectors.md) in a child is simpler and more explicit than a context.

Place the provider close to the feature it belongs to. A provider at the application root gives every instance of that feature the same actor, which is rarely what you want for per-item state. For state that belongs to the whole application, see [global state](global-state.md).

## TypeScript

Snapshot, event and actor reference types come from the logic. `Provider` requires `options.input` when the logic requires input.

```tsx
const CheckoutContext = createActorContext(checkoutMachine);

const total = CheckoutContext.useSelector((s) => s.context.total); // number
const actorRef = CheckoutContext.useActorRef(); // Actor<typeof checkoutMachine>
```

## Shared actors cheatsheet

```tsx
const Ctx = createActorContext(logic, defaultOptions);

<Ctx.Provider options={{ input, snapshot }} logic={overrideLogic}>
  {children}
</Ctx.Provider>;

Ctx.useSelector((snapshot) => snapshot.context.value);
Ctx.useSelector((snapshot) => snapshot.context.user, shallowEqual);
Ctx.useActorRef();
```
