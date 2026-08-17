---
title: Transitions
description: Configure event, delayed, eventless and completion transitions.
---

A transition describes how a state responds to an event.

```ts
idle: { on: { start: { target: 'active' } } }
```

## Transition properties

| Property | Description |
| --- | --- |
| `target` | Target state or states. |
| `matches` | Event payload that must match. |
| `context` | Context patch or mapper. |
| `input` | Input for the target state. |
| `reenter` | Re-enter the source state when targeting it. |
| `meta` | Per-transition metadata. |
| `description` | Human-readable description. |

There is no `guard` property. Conditions live inside the transition function, which returns `undefined` to reject the event. See [guards](guards.md).

A targetless transition can update context and run effects without leaving the current state. Set `reenter: true` when a self-transition should run exit and entry behavior again.

```ts
on: {
  rename: ({ context, event }) => ({
    context: { ...context, name: event.name }
  }),
  restart: { target: 'active', reenter: true }
}
```

## Transition functions

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

Returning `undefined` prevents the transition.

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
| `xstate.timeout` | `stateId` |

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

Transition arrays are not accepted by the authoring APIs. An event maps to a single transition. Return a target from a transition function to choose among several, and use `matches` to select a payload. Serialized transition arrays are still accepted by `createMachineFromConfig(...)`.

```ts
on: {
  submit: ({ context }) =>
    context.role === 'admin'
      ? { target: 'adminReview' }
      : { target: 'standardReview' }
}
```

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
```
