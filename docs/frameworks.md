---
title: Use with your framework
description: Connect XState actors to React, Vue, Svelte, and Solid components.
---

XState is framework-agnostic. Machines and actors run the same way everywhere. The framework packages connect actors to your component model: they create or receive an actor, subscribe to its snapshots, and re-render when the values you read change.

Install the package for your framework alongside `xstate`:

```bash
npm install xstate@alpha @xstate/react@alpha
```

## React

[`@xstate/react`](react/use-machine.md) provides hooks for running and reading actors.

```tsx
import { useActor } from '@xstate/react';

function Player() {
  const [snapshot, send] = useActor(playerMachine);

  return (
    <button onClick={() => send({ type: 'play' })}>
      {snapshot.matches('playing') ? 'Playing' : 'Play'}
    </button>
  );
}
```

- [`useActor` and `useActorRef`](react/use-machine.md)
- [Selectors with `useSelector`](react/selectors.md)
- [Shared actors with `createActorContext`](react/shared-actors.md)
- [Input and snapshots](react/input-and-snapshots.md)
- [Server rendering](react/server-rendering.md)

## Vue

[`@xstate/vue`](vue/use-machine.md) provides composables. `useActor` returns a reactive `snapshot` ref and a `send` function.

- [`useActor` and `useActorRef`](vue/use-machine.md)
- [Selectors](vue/selectors.md)
- [Shared actors](vue/shared-actors.md)
- [Server rendering](vue/server-rendering.md)

## Svelte

[`@xstate/svelte`](svelte/use-machine.md) provides stores. `useSelector` returns a readable store you can subscribe to with `$`.

- [`useActor` and `useActorRef`](svelte/use-machine.md)
- [Selectors](svelte/selectors.md)
- [Shared actors](svelte/shared-actors.md)
- [Server rendering](svelte/server-rendering.md)

## Solid

[`@xstate/solid`](solid/use-machine.md) provides primitives. Use `fromActorRef` with `createMemo` for fine-grained reactive reads.

- [`useActor` and `useActorRef`](solid/use-machine.md)
- [Selectors](solid/selectors.md)
- [Shared actors](solid/shared-actors.md)
- [Server rendering](solid/server-rendering.md)

## Other frameworks and no framework

Any environment that can call `createActor(...)`, `actor.subscribe(...)`, and [`actor.select(...)`](selectors.md) can integrate XState. Actors also run without any framework: on servers for [backend workflows](backend-workflows.md), in workers, and in plain scripts.

For simple event-based state without statecharts, see [`@xstate/store`](../../xstate-store/v4/quick-start.md), which ships bindings for React, Vue, Svelte, Solid, Preact, and Angular.
