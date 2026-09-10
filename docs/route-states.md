---
title: Route states
description: Mark states as directly navigable and jump to them with xstate.route.
---

A state with an explicit `id` may declare a `route`, which marks it as directly navigable. Send `{ type: 'xstate.route', to: '#id' }` and the actor transitions straight there. The source state does not need its own event-to-target transition.

```ts
const machine = createMachine({
  id: 'app',
  initial: 'home',
  states: {
    home: { id: 'home', route: {} },
    checkout: { id: 'checkout', route: {} },
    receipt: { id: 'receipt', route: ({ context }) => context.paid }
  }
});

const actor = createActor(machine).start();

actor.send({ type: 'xstate.route', to: '#checkout' }); // -> 'checkout'
```

Two things are required: an explicit `id` and a `route`. A state with `route: {}` but no `id` is not routable, and a state with an `id` but no `route` is not routable either. Sending `xstate.route` at a non-routable state does nothing: the event is unhandled and the actor stays in its current state.

## Route as a guard

The `route` value is either a config object or a transition-style function that acts as both guard and resolver.

- returning `undefined` or `false` blocks the route
- returning `true` allows it
- returning a config object allows it and applies the object

```ts
states: {
  home: { id: 'home', route: {} },
  profile: {
    id: 'profile',
    route: ({ context }) => {
      if (!context.loggedIn) return; // blocked, like an unhandled transition
      return { context: { ...context, visits: context.visits + 1 } };
    }
  }
}
```

Routing to `#profile` while logged out leaves the actor on `home` and does not touch `visits`. After the context says `loggedIn`, the same event enters `profile` and increments `visits` in the same step.

The config object accepts `context`, `input`, `reenter`, `meta` and `description`. Named `guards` are available on the function arguments, exactly as in [guards](guards.md):

```ts
review: {
  id: 'review',
  route: (args) => args.guards.isReady(args)
}
```

## Nested and parallel targets

Routes work anywhere in the tree. Routing to a deeply nested state enters all of its ancestors:

```ts
actor.send({ type: 'xstate.route', to: '#overview' });
// -> { dashboard: 'overview' }
```

In a parallel machine, a route only moves the region that contains the target. Routing to `#filter-active` in a todo machine changes `filter` from `all` to `active` and leaves the `todo` region untouched.

Route targets are always a single `#id`. Dot-separated paths like `#dashboard.overview` are not valid route targets and do nothing.

Routing to the state the actor is already in re-enters it: exit and entry actions run again. If that state's `route` function blocks, nothing happens.

Use route states for:

- a wizard or checkout whose steps are reachable from a URL or a progress bar
- filter tabs in a parallel machine, where `all`, `active` and `completed` are each addressable
- a media player deep link that jumps straight to a `nowPlaying` screen when a track id is known

## TypeScript

Route events are strongly typed. The `to` field only accepts `#id` strings for states that declare both an `id` and a `route`. A plain state key, the machine's own id, and a name that does not exist are all type errors. `machine.root.on['xstate.route']` is defined whenever the machine contains at least one route.

Inside a route function, `context`, `event` and `guards` are inferred from the machine's schemas. When a machine is built from JSON with `createMachineFromConfig`, a route may reference a guard by name; an unimplemented name errors the actor at route time with `Guard 'isReady' is not implemented in machine 'flow'`.

For a setup-defined route, declare `id` and `route: true` in the state
contract. The machine config may omit both fields, and the route event remains
typed against the declared `#id`.

## Route states cheatsheet

```ts
const machine = createMachine({
  id: 'flow',
  initial: 'amount',
  context: { ready: false },
  states: {
    amount: { id: 'amount', route: {} },
    review: { id: 'review', route: ({ context }) => context.ready },
    done: {} // no id + route: not routable
  }
});

createActor(machine).start().send({ type: 'xstate.route', to: '#review' });
```
