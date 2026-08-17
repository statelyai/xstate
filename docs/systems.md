---
title: Actor systems
description: Address actors within the same actor system.
---

Every root actor creates an actor system. Every descendant actor, invoked or spawned at any depth, belongs to that same system. The system is available as `actor.system` from the outside, and as the `system` argument inside transition, entry and exit functions.

The system holds a registry: a flat map of keys to actor references. Register an actor with `registryKey`, then look it up with `system.get(...)`.

```ts
const worker = enq.spawn(workerLogic, {
  registryKey: 'primary-worker'
});

const primaryWorker = system.get('primary-worker');
```

Use the registry for actors that must be reached across ownership boundaries, such as:

- a notification service any state in the tree can send to
- a shared connection actor used by several distant children
- a long-lived cache that outlives whichever feature spawned it

Prefer direct child references when the parent already owns the child. `children.worker` inside the parent is clearer than a registry lookup, and it is typed.

## Registering actors

A `registryKey` can be assigned in three places.

```ts
// on an invocation
invoke: { src: childLogic, registryKey: 'receiver' }

// on a spawn
enq.spawn(childLogic, { registryKey: 'receiver' })

// on the root actor
createActor(machine, { registryKey: 'root' });
```

Registration happens as soon as the actor reference exists, so keys resolve before the root actor starts. `createActor(machine).system.get('receiver')` is defined without calling `start()`.

`system.get(key)` returns the `ActorRef` or `undefined`. `system.getAll()` returns a partial map of every registered actor.

Keys are unique within a system. Registering a second actor under a key already in use errors the actor.

Entries are removed when their actor stops, whether the invocation's state is exited or the actor is stopped with `enq.stop(...)`.

```ts
actor.system.get('worker'); // ActorRef
actor.send({ type: 'toggle' }); // exits the invoking state
actor.system.get('worker'); // undefined
```

Because a key can be vacant, always handle `undefined`:

```ts
on: {
  notify: ({ system, event }, enq) => {
    const notifications = system.get('notifications');
    if (notifications) {
      enq.sendTo(notifications, event);
    }
  }
}
```

## Typed registries

Declare the registry up front with `createSystem({ registry })` to get typed keys without casts. Keys map to actor logic; `system.get(key)` returns the actor reference for that logic.

```ts
const system = createSystem({
  registry: {
    receiver: receiverLogic
  }
});

const machine = system.setup().createMachine({
  invoke: { src: receiverLogic, registryKey: 'receiver' },
  on: {
    ping: ({ system }, enq) => {
      enq.sendTo(system.get('receiver'), { type: 'HELLO' });
    }
  }
});

const actor = system.createActor(machine).start();
```

`createSystem(...).setup(...)` chains into the usual [setup](setup-and-provide.md) API and carries the registry types into every machine built from it. `registryKey` is then checked against the declared registry, and the `system` argument inside transition functions is typed the same way, so no `ActorSystem<...>` cast is needed.

The system builder also owns the runtime system before any actor exists. `system.get(...)`, `system.getAll()` and `system.inspect(...)` work on the builder and forward to the running system once the root actor is created.

```ts
const system = createSystem({ registry: { root: machine } });

system.get('root'); // undefined before createActor
const actor = system.createActor(machine, { registryKey: 'root' });
system.get('root'); // the root actor
```

## TypeScript

Without a declared registry, `system.get(key)` is untyped. Annotate the system with `ActorSystem<{ actors: { receiver: ActorRef<...> } }>` or, preferably, use `createSystem({ registry })` so keys and reference types are inferred.

## Actor systems cheatsheet

```ts
const child = enq.spawn(logic, { registryKey: 'service' });
const service = system.get('service');
const all = system.getAll();

const system = createSystem({ registry: { service: logic, root: machine } });
const actor = system.createActor(machine, { registryKey: 'root' }).start();
```
