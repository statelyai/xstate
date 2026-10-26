---
title: Transitions
description: Configure event, delayed, eventless and completion transitions.
---

A transition describes how a state responds to an event.

```ts
idle: { on: { start: { target: 'active' } } }
```

## Transition properties

<!-- transition config properties from packages/core/src/types.v6.ts -->

| Property | Description |
| --- | --- |
| `target` | Target state or states: a sibling key, a `.`-separated path, a `.child` descendant, or a `#id` (a state's whole explicit or implicit id; see [target by id](#target-by-id)). Escape a literal dot in a key as `\\.`. |
| `matches` | Event payload that must match. |
| `context` | Context patch or mapper. |
| `input` | Input for the target state. |
| `reenter` | Re-enter the source state when targeting it. |
| `meta` | Per-transition metadata. |
| `description` | Human-readable description. |

Use `schemas.transitionMeta` to type transition metadata separately from state
metadata. If omitted, transition metadata uses `schemas.meta`.

```ts
schemas: {
  meta: z.object({ label: z.string() }),
  transitionMeta: z.object({ trackingId: z.number() })
}
```

There is no `guard` property. Conditions live inside the transition function, which returns `undefined` to reject the event. Check the condition before calling `enq`: a function that calls `enq` is taken even if it returns `undefined`. See [guards](guards.md).

A targetless transition can update context and run effects without leaving the current state. Set `reenter: true` when a self-transition should run exit and entry behavior again.

```ts
on: {
  rename: ({ context, event }) => ({
    context: { ...context, name: event.name }
  }),
  restart: { target: 'active', reenter: true }
}
```

## Target by id

A `#` target names one state by its id. The text after `#` is matched exactly against the state ids and is never split into a path. A state's id is its explicit `id`, or else its implicit id: the path from the root joined by `.`, prefixed by the machine `id` when there is one.

```ts
const machine = createMachine({
  id: 'shop',
  initial: 'browsing',
  states: {
    browsing: {
      on: {
        edit: { target: '#flow' },
        review: { target: '#shop.wizard.review' }
      }
    },
    wizard: {
      id: 'flow',
      initial: 'details',
      states: { details: {}, review: {} }
    }
  }
});
```

`#flow` targets `wizard` by its explicit id. `#shop.wizard.review` targets `review` by its implicit id. `#flow.review` is not a valid target: no state has the id `flow.review`, and an id is not combined with a relative path. Creating the machine with it throws:

```
No state has id "flow.review". Use "#shop.wizard.review", or give that state an id.
```

Only an id followed by a path fails. Any whole id is a valid target, including an explicit id that contains dots: `id: 'checkout.v2'` is targeted as `#checkout.v2`, without escaping. Key segments in implicit ids keep their `\\.` escapes (`#shop.foo\\.bar`).

## Transition functions

See [transition functions and graph analysis](transition-functions.md) for why functions preserve type narrowing, how to keep destinations visible and the limits of static extraction.

```ts
submit: ({ context, event }, enq) => {
  if (!context.valid) return;
  enq(() => console.log('Submitted', event));
  return {
    target: 'submitting',
    context: { ...context, submittedAt: Date.now() }
  };
}
```

Returning `undefined` prevents the transition, unless the function already called `enq`: any `enq` call selects the transition, which then runs as a targetless transition with the queued effects. That is why the example returns before enqueuing.

Transition functions must be synchronous. A transition function that returns a promise throws an execution error, which a state `onError` can recover. Move async work into an invoked or spawned actor, or into an effect enqueued with `enq(...)`. The `enq` handle is only valid while the function runs: calling `enq.*` after the function returned throws in development and does nothing in production.

`always` runs without an external event. `after` runs after a delay. `onDone`, `onError` and `onTimeout` handle actor outcomes.

Use targetless transitions for edits that keep a form on the same step. Use re-entering transitions to restart a timer, subscription or invoked request.

Put shared transitions on a parent state. A child can set an event to `undefined` to forbid that parent transition. Wildcards such as `pointer.*` match an event family when no exact transition matches.

```ts
on: {
  'pointer.*': { target: 'tracking' },
  '*': { target: 'unexpectedEvent' }
}
```

## Match event payloads

Internal lifecycle events use stable category types and carry the identity of what produced them:

| Event type | Identity |
| --- | --- |
| `xstate.done.actor` | `actorId`, `sessionId` |
| `xstate.error.actor` | `actorId`, `sessionId` |
| `xstate.timeout.actor` | `actorId`, `sessionId` |
| `xstate.done.state` | `stateId` |
| `xstate.after` | `stateId`, `delay` |
| `xstate.timeout.state` | `stateId` |

Use `matches` to select one payload of an event type:

```ts
on: {
  'xstate.done.actor': {
    matches: { actorId: 'job' },
    target: 'complete'
  }
}
```

`matches` is a shallow partial pattern over the event's payload, compared by identity, so use it with primitive values. It is checked before the transition function runs. It works on any event, not only lifecycle events. `onDone`, `onError`, `onTimeout` and `after` set `matches` for you, which is how each one selects its own actor or state.

## One transition per event

Transition arrays are not accepted by the authoring APIs. An event maps to a single transition. Return a target from a transition function to choose among several, and use `matches` to select a payload. Serialized transition arrays are still accepted by `machineFromJSON(...)`.

```ts
on: {
  submit: ({ context }) =>
    context.role === 'admin'
      ? { target: 'adminReview' }
      : { target: 'standardReview' }
}
```

## Unhandled events

An event is unhandled when no transition in the active states, including wildcard transitions, handles it. A transition function that returns `undefined` and enqueues nothing does not handle the event. An unhandled event leaves the actor unchanged.

The pure `transition(logic, snapshot, event)` API returns the same snapshot object and no effects for an unhandled event. A handled event always returns a new snapshot object, even when a transition function returns `{}`. Use `isUnhandled(...)` to check:

```ts
import { isUnhandled, transition } from 'xstate';

const result = transition(machine, snapshot, event);
if (isUnhandled(snapshot, result)) {
  // no transition handled `event`
}
```

A running actor reports an unhandled event through the `onUnhandledEvent` option of `createActor(...)`. In the [inspection](inspection.md) stream, the `@xstate.transition` event for an unhandled event carries the unchanged snapshot reference. Development builds also log a warning once per event type per actor. Framework `xstate.*` events delivered by actors are not reported, except `xstate.route`. Actor stop events are also excluded. Unhandled events sent through `actor.send(...)` are reported even when their names start with `xstate.`, including obsolete names such as `xstate.done.actor.save`.

## TypeScript

Transition targets are checked against authored state paths. Event schemas narrow `event` inside transition functions.

## Transitions cheatsheet

```ts
on: { submit: { target: 'loading' } }
on: { rename: ({ context, event }) => ({ context: { ...context, name: event.name } }) }
on: { cancel: undefined }
always: { target: 'ready' }
after: { 1000: { target: 'idle' } }
on: { 'xstate.done.actor': { matches: { actorId: 'job' }, target: 'done' } }
onDone: { target: 'success' }
onError: { target: 'failure' }
on: { edit: { target: '#flow' } } // whole explicit or implicit id
```
