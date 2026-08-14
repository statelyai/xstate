---
title: Invoke actors
description: Run a child actor for the lifetime of a state.
---

Use `invoke` to start a child actor when a state is entered. The child stops when that state is exited.

```ts
const machine = createMachine({
  initial: 'loading',
  states: {
    loading: {
      invoke: {
        src: loadUser,
        input: ({ context }) => ({ id: context.userId }),
        onDone: { target: 'ready' },
        onError: { target: 'failed' },
        timeout: 5_000,
        onTimeout: { target: 'timedOut' }
      }
    },
    ready: {},
    failed: {},
    timedOut: {}
  }
});
```

Use an actor instead of an action when work is async, can be canceled, sends snapshots or affects the next state. Common examples are payment authorization and file uploads.

## Invoke properties

| Property | Description |
| --- | --- |
| `src` | Required. The [actor logic](actor-logic.md) to run: a logic value, the name of logic registered in `actors`, or a function that returns either. |
| `id` | Identifier for the child. Defaults to a generated id based on the state node. |
| `input` | [Input](input-output.md) for the child: a value, or a function of `{ context, event, self }`. |
| `registryKey` | Registers the child in the [actor registry](systems.md) under that key. |
| `timeout` | Milliseconds, or a function of `{ context, event }` returning milliseconds. |
| `onTimeout` | Transition taken when `timeout` elapses. Required when `timeout` is set. |
| `onDone` | Transition taken when the child completes. `event.output` holds its output. |
| `onError` | Transition taken when the child errors. `event.error` holds the error. |
| `onSnapshot` | Transition taken on each child snapshot. `event.snapshot` holds the snapshot. |

Only `src` is required. A state node accepts a single invoke config or an array of them.

```ts
invoke: [
  { src: heartbeat, id: 'heartbeat' },
  { src: syncLogic, id: 'sync', onError: { target: 'offline' } }
]
```

## Actor lifecycle

Invoked actors belong to the state that starts them:

- entering the state starts the actor
- leaving the state stops it
- re-entering the state stops the old actor and starts a new one

A state is re-entered by an external transition back to itself, or by a transition with `reenter: true`. A transition that stays inside the invoking state does not restart the child.

Invoke on the machine root runs for the whole lifetime of the actor. Root invocations survive ordinary transitions between top-level states, and restart only on a root [transition](transitions.md) with `reenter: true`.

```ts
const machine = createMachine({
  invoke: { src: connection, id: 'connection' },
  initial: 'idle',
  states: { idle: {}, playing: {} }
});
```

Children are started after the parent snapshot is committed, so a child that immediately sends an event to its parent finds the parent already in the invoking state.

## Choosing logic

Invoke a machine when the child has states of its own:

```ts
checkout: {
  invoke: {
    src: paymentMachine,
    id: 'payment',
    input: ({ context }) => ({ amount: context.total }),
    onDone: { target: 'confirmed' }
  }
}
```

Invoke [async logic](async-logic.md) for a single request. The child completes with the resolved value and errors with a rejection:

```ts
const chargeCard = createAsyncLogic({
  run: ({ input, signal }) => createCharge(input.amount, { signal })
});
```

Invoke [callback logic](actor-logic.md) for a subscription that lives as long as the state:

```ts
playing: {
  invoke: {
    src: createCallbackLogic(({ sendBack }) => {
      const id = setInterval(() => sendBack({ type: 'tick' }), 1000);
      return () => clearInterval(id);
    })
  },
  on: { tick: ({ context }) => ({ context: { time: context.time + 1 } }) }
}
```

## Reacting to the child

`onDone` receives final output, `onError` an unhandled error, and `onSnapshot` each intermediate snapshot.

```ts
invoke: {
  src: uploadMachine,
  onSnapshot: ({ context, event }) => ({
    context: {
      ...context,
      progress: event.snapshot.context.progress
    }
  }),
  onDone: { target: 'complete' },
  onError: { target: 'failed' }
}
```

These are conveniences over lifecycle events. The child sends `xstate.done.actor`, `xstate.error.actor` and `xstate.snapshot.actor` events with an `actorId` payload; `onDone`, `onError` and `onSnapshot` set `matches: { actorId }` for you so each one only handles its own child. Handle the event directly when the transition belongs on an ancestor state:

```ts
on: {
  'xstate.done.actor': { matches: { actorId: 'payment' }, target: 'confirmed' }
}
```

See [transitions](transitions.md) for `matches` and the full list of lifecycle events.

## Timing out an invocation

`timeout` bounds how long the invocation may run. When it elapses, `onTimeout` is taken and the child is stopped by exiting the state. When the child finishes first, the timeout is canceled.

```ts
authorizing: {
  invoke: {
    src: authorizePayment,
    timeout: ({ context }) => context.authTimeout,
    onTimeout: { target: 'declined' },
    onDone: { target: 'authorized' }
  }
}
```

Setting `timeout` without `onTimeout` throws when the machine is created. Use `createAsyncLogic({ timeout })` instead when the timeout belongs to the logic rather than to this particular invocation. See [timeouts](timeouts.md).

## Referencing the child

Invoked children appear on `snapshot.children` under their `id`, and transition functions receive them as `children`:

```ts
on: {
  cancel: ({ children }, enq) => {
    enq.sendTo(children.payment, { type: 'cancel' });
  }
}
```

A child sends events back through its `parent` argument:

```ts
const paymentMachine = createMachine({
  on: {
    approve: ({ parent }, enq) => {
      enq.sendTo(parent, { type: 'paymentApproved' });
    }
  }
});
```

## Persistence

Invoked children are persisted with the parent snapshot and restored by `createActor(machine, { snapshot })`. A child restored this way keeps its context but gets a new session.

Register logic in `actors` and reference it by name when the persisted snapshot should stay readable and stable across refactors:

```ts
const machine = createMachine({
  actors: { chargeCard },
  initial: 'charging',
  states: {
    charging: { invoke: { src: 'chargeCard', id: 'charge' } }
  }
});
```

The persisted child then records `src: 'chargeCard'` instead of a generated source name that points back at this invoke config. Either restores, but a named source survives moving the invoke to another state. See [persistence](persistence.md).

## Common pitfalls

Invoke belongs to the state, not to the transition that led there. This is wrong:

```ts
on: {
  submit: {
    target: 'sending',
    // ❌ invoke is not a transition property
    invoke: { src: sendOrder }
  }
}
```

Put the invoke on the target state instead, so the actor starts when `sending` is entered and stops when it is left.

Invoke also is not the right tool when the child must outlive the state, or when the number of children is dynamic. [Spawn](spawn.md) those instead.

## TypeScript

Provide named actor logic through `setup({ actors })` or `createMachine({ actors })`. XState correlates `src` with `input`, so a static or mapped input is checked against that logic's input type, and `onDone` sees the output type of that logic.

Declare child ids with `schemas.children` to type `children` and to check that each `id` receives compatible logic:

```ts
setup({}).createMachine({
  schemas: {
    children: {
      payment: z.custom<ActorRefFromLogic<typeof paymentMachine>>()
    }
  },
  invoke: { id: 'payment', src: paymentMachine }
});
```

`children.payment` is then typed, `children.other` is a type error, and invoking incompatible logic under `id: 'payment'` is rejected.

## Invoke cheatsheet

```ts
invoke: {
  id: 'request',
  src: requestLogic,
  input: ({ context }) => context.request,
  registryKey: 'request',
  timeout: 10_000,
  onTimeout: { target: 'timedOut' },
  onDone: { target: 'success' },
  onError: { target: 'failure' },
  onSnapshot: ({ event }) => ({ context: { snapshot: event.snapshot } })
}
```
