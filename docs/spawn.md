---
title: Spawn actors
description: Create child actors during a transition.
---

Use `enq.spawn(...)` when a child should outlive the state that created it, or when the number of children is dynamic.

```ts
on: {
  'file.added': ({ context, event }, enq) => {
    const upload = enq.spawn(uploadLogic, {
      id: `upload-${event.fileId}`,
      input: { file: event.file }
    });

    return {
      context: {
        ...context,
        uploads: [...context.uploads, upload]
      }
    };
  }
}
```

`enq.spawn(source, options)` returns the [actor reference](actors.md) immediately, so the same transition can store it, send to it or subscribe to it. `source` may be registered actor logic or its registered name.

## Spawn options

| Option | Description |
| --- | --- |
| `id` | Identifier for the child, and its key in `snapshot.children`. Defaults to a deterministic generated id keyed by the actor source, such as `worker:0`. |
| `input` | [Input](input-output.md) for the child. Required when its logic requires input. |
| `registryKey` | Registers the child in the [actor registry](systems.md) under that key. |
| `syncSnapshot` | When `true`, each child snapshot is sent to the parent as an `xstate.snapshot.actor` event. |

Use a registered name when its durable source identity matters:

```ts
entry: (_, enq) => {
  enq.spawn('upload', { input: { file } });
};
```

The name is checked against `actors`; its required input and returned actor reference are inferred from that entry. An unknown name is a type error. If a declared entry has not been implemented through the machine config, `provide(...)` or `extend(...)`, spawning it throws immediately.

Passing the logic value remains convenient: `enq.spawn(actors.upload, options)`. XState recovers its registered name when possible. Inline unregistered logic may run but cannot be durably persisted.

Spawning with an `id` that a live child of the same parent already uses throws: an address names at most one live actor. Stop the existing child first — an id stopped earlier in the same transition is free to reuse, and a child that completed on its own frees its id for the transition handling its completion. Generate ids from something stable, such as a file or participant id.

## Where you can spawn

`enq.spawn(...)` is available in every transition function: `entry`, `exit`, `on`, `always` and `after`. A child spawned in `exit` still starts, because the spawn is part of the transition, not part of the state being left.

The context initializer also receives a `spawn` function for children that exist from the start:

```ts
const machine = createMachine({
  actors: { connection },
  context: ({ spawn, actors }) => ({
    connection: spawn(actors.connection, { id: 'connection' })
  })
});
```

## Spawn or invoke

| | [Invoke](invoke.md) | Spawn |
| --- | --- | --- |
| Started by | Entering a state | A transition function |
| Stopped by | Exiting that state | `enq.stop(ref)`, or the parent stopping |
| How many | Fixed by the config | Any number, decided at runtime |
| Outcome handling | `onDone`, `onError`, `onSnapshot` | `enq.subscribeTo(...)`, `enq.listen(...)` |
| Persistence | Restored with the parent | See below |

Invoke a payment actor for the `authorizing` state. Spawn one upload actor per selected file, one participant actor per person in a call, or one track actor per queued item in a media player.

## Referencing spawned children

Spawned children appear on `snapshot.children` under their `id` and are passed to transition functions as `children`:

```ts
on: {
  'upload.cancel': ({ children, event }, enq) => {
    enq.sendTo(children[`upload-${event.fileId}`], { type: 'cancel' });
  }
}
```

Store references in `context` instead when the machine needs its own ordering, grouping or metadata, such as an array of uploads rendered in order. Keep the context list and the children record in sync: `children` only reflects live actors.

## Stopping spawned actors

A spawned actor runs until it completes, until `enq.stop(ref)` stops it, or until the parent actor stops. Exiting the state that spawned it does not stop it.

```ts
on: {
  'upload.remove': ({ context, event }, enq) => {
    const upload = context.uploads.find((ref) => ref.id === event.id);
    enq.stop(upload);

    return {
      context: {
        ...context,
        uploads: context.uploads.filter((ref) => ref !== upload)
      }
    };
  }
}
```

`enq.stop(ref)` removes the child from `snapshot.children` in the same transition. Remove the stored reference from context at the same time, otherwise the machine holds a reference to a stopped actor. A machine can only stop its own children; stopping any other actor reference errors.

## Communicating with spawned actors

Send events to a child with `enq.sendTo(ref, event)`. A child machine sends events back through its `parent` argument:

```ts
const uploadMachine = createMachine({
  on: {
    progress: ({ parent, event }, enq) => {
      enq.sendTo(parent, { type: 'uploadProgress', value: event.value });
    }
  }
});
```

Spawned children have no `onDone` or `onError`. Subscribe to their outcome instead:

```ts
entry: (_, enq) => {
  const upload = enq.spawn(uploadLogic, { id: 'upload' });

  enq.subscribeTo(upload, {
    done: (output) => ({ type: 'uploadFinished', output }),
    error: (error) => ({ type: 'uploadFailed', error })
  });

  enq.listen(upload, 'upload.*', (event) => ({
    type: 'uploadEvent',
    eventType: event.type
  }));
};
```

<!-- enq.listen and enq.subscribeTo behavior from packages/core/src/stateUtils.ts and packages/core/src/transitionActions.ts -->

`enq.listen(...)` maps [emitted events](emitted-events.md), while
`enq.subscribeTo(...)` maps snapshots and outcomes. Both return an actor that
can be stopped with `enq.stop(...)`, and both work in transition, `entry` and
`exit` functions. See [listen and subscribe](listen-and-subscribe.md).

`syncSnapshot: true` is the lower-level alternative: the parent then receives `xstate.snapshot.actor` events that it can handle with `matches: { actorId }`.

## Persistence

<!-- registered spawn source persistence behavior from packages/core/src/spawn.ts, packages/core/src/transitionActions.ts, and packages/core/src/StateMachine.ts -->

Children spawned from sources registered in `actors` are persisted and restored with the parent snapshot. The context initializer accepts registered logic. Transition functions additionally accept its typed name:

```ts
const machine = createMachine({
  actors: { connection },
  context: ({ spawn, actors }) => ({
    connection: spawn(actors.connection, { id: 'connection' })
  }),
  on: {
    reconnect: (_, enq) => {
      enq.spawn('connection', { id: 'replacement' });
    }
  }
});
```

Each child records `src: 'connection'`, which `createActor(machine, { snapshot })` resolves back to the currently registered logic. `provide(...)` may replace that implementation under the same source key. Restoring a snapshot whose child source is not registered fails instead of silently dropping the child.

Register persistent child logic in `actors`. Spawning inline logic that is not registered works while the parent is running, but `getPersistedSnapshot()` throws `An inline child actor cannot be persisted.` while that child exists.

Several source keys may share one logic object. `enq.spawn('second')` records exactly `src: 'second'`, so implementations under those names may diverge through `provide(...)`, `extend(...)` or a later machine version. Passing the shared logic value instead uses the first registered key as its canonical source identity.

## TypeScript

`enq.spawn(...)` returns an actor reference typed from the selected source or logic, and requires `input` when it requires input. Type references stored in context with `ActorRefFrom`:

```ts
const machine = createMachine({
  schemas: {
    context: z.object({
      uploads: z.custom<ActorRefFrom<typeof uploadLogic>[]>()
    })
  },
  context: { uploads: [] }
});
```

Declare `schemas.children` to type the `children` record for known ids:

```ts
schemas: {
  children: {
    connection: z.custom<ActorRefFromLogic<typeof connection>>()
  }
}
```

`children.connection` is then typed, and unknown keys are type errors. Dynamic children keyed by a runtime id stay typed through the context array instead.

## Spawn cheatsheet

```ts
const child = enq.spawn(logic, { id, input, registryKey, syncSnapshot: true });
const durableChild = enq.spawn('registeredSource', { id, input });
enq.sendTo(child, { type: 'start' });
enq.subscribeTo(child, { done: (output) => ({ type: 'finished', output }) });
enq.stop(child);
```
