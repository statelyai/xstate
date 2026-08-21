---
title: Final states
description: Mark a state as complete and produce output.
---

A final state marks its parent as complete. When a child final state is reached, the parent raises a done event and its `onDone` transition is taken.

```ts
uploading: {
  initial: 'sending',
  states: {
    sending: { on: { finish: { target: 'sent' } } },
    sent: { type: 'final' }
  },
  onDone: { target: 'uploaded' }
}
```

`onDone` belongs to the parent state, not to the final child. It is written like any other transition: an object config or an inline transition function.

## Output

A final state can carry `output`, either a static value or a function of `context` and `event`.

```ts
review: {
  initial: 'pending',
  states: {
    pending: { on: { decide: { target: 'decided' } } },
    decided: {
      type: 'final',
      output: ({ event }) => ({ approved: event.approved })
    }
  },
  onDone: ({ event }) => ({
    target: 'archived',
    context: { approved: event.output.approved }
  })
}
```

The parent's `onDone` reads that value from `event.output`. An `output` mapper sees context that the final state's own `entry` has already updated.

> **Warning:** `output` is only read on final states and on the machine root. Declared anywhere else it is silently ignored.

## Completing the machine

A top-level final state completes the machine actor. `snapshot.status` becomes `'done'` and `snapshot.output` holds the machine output.

```ts
const checkoutMachine = createMachine({
  initial: 'paying',
  states: {
    paying: { on: { paid: { target: 'confirmed' } } },
    confirmed: { type: 'final', output: { status: 'paid' } }
  }
});

const checkout = createActor(checkoutMachine).start();
checkout.send({ type: 'paid' });

checkout.getSnapshot().status; // 'done'
checkout.getSnapshot().output; // { status: 'paid' }
```

Without a root `output`, the reached final state's output becomes the machine output. With both, the final state's output is resolved first and passed to the root mapper as `output`:

```ts
states: {
  confirmed: { type: 'final', output: 'paid' }
},
output: ({ output }) => `checkout: ${output}` // 'checkout: paid'
```

A static root `output` replaces the final state's output; with neither, `snapshot.output` is `undefined`. Output is resolved once and is preserved by [`getPersistedSnapshot()`](persistence.md).

## Parallel completion

A [parallel](parallel-states.md) state completes only when every region has reached a final state. Its done event carries an object of region outputs keyed by region name.

```ts
active: {
  type: 'parallel',
  states: {
    upload: { initial: 'busy', states: { busy: {}, ok: { type: 'final', output: { bytes: 1024 } } } },
    scan: { initial: 'busy', states: { busy: {}, ok: { type: 'final', output: 'clean' } } }
  },
  onDone: ({ event }) => ({ target: 'ready' })
  // event.output === { upload: { bytes: 1024 }, scan: 'clean' }
}
```

A parallel machine root reaches `status: 'done'` the same way, but does not surface the aggregate automatically. Add a root `output` mapper to expose it.

```ts
output: ({ output }) => output // { upload: { bytes: 1024 }, scan: 'clean' }
```

## The done event

The done event is `{ type: 'xstate.done.state', stateId, output }`. `stateId` identifies the state that completed. `onDone` compiles to that event type with a `matches: { stateId }` filter, which is why one parent's `onDone` never reacts to another's completion.

Handle it explicitly with the same filter, though `onDone` is preferable. A bare `'xstate.done.state'` handler with no `matches` reacts to every completing state.

```ts
on: {
  'xstate.done.state': { matches: { stateId: 'checkout.payment' }, target: 'receipt' }
}
```

An [invoked](invoke.md) machine that reaches a top-level final state completes, and the invoking state takes its `onDone` with the child's output.

```ts
invoke: {
  src: checkoutMachine,
  onDone: ({ event }) => ({ target: 'receipt', context: { receipt: event.output } })
}
```

## After completion

When a machine completes, exit actions run in reverse document order, every child actor is stopped, and every pending [timer](timeouts.md) is canceled. Events sent afterwards are ignored with a warning.

Because of this, transitions declared on a top-level final state are unreachable, since the actor has already stopped. Inside a completed parallel region, a transition from a final state yields to a conflicting transition from a region that is still live. Use final states when a checkout is confirmed, a file has been uploaded and scanned, or a multi-step form has been submitted.

## TypeScript

`output` on a final state and on the machine root are typed against `schemas.output`. With `setup({ states })`, a state can additionally declare `schemas.output` for its own completion value; its parent's `onDone` receives that local type. The root mapper's `output` argument is typed as the completing state's output. `onDone` handlers receive `DoneStateEvent`, whose `output` is the completed state's output and whose `stateId` is a string. See [input and output](input-output.md).

## Final states cheatsheet

```ts
// final child completes its parent
done: { type: 'final' }
parent: { states: { done: { type: 'final' } }, onDone: { target: 'next' } }

// output from a final state
done: { type: 'final', output: ({ context }) => ({ id: context.id }) }

// machine output
createMachine({ states: { done: { type: 'final' } }, output: ({ output }) => output });

// reading completion
snapshot.status; // 'done'
snapshot.output;

// invoked machine completion
invoke: { src: child, onDone: ({ event }) => ({ target: 'next' }) }
```
