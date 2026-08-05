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
| `guard` | Condition that must pass. |
| `reenter` | Re-enter the source state when targeting it. |
| `description` | Human-readable description. |

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

## TypeScript

Transition targets are checked against authored state paths. Event schemas narrow `event` inside transition functions.

## Transitions cheatsheet

```ts
on: { submit: { target: 'loading' } }
on: { rename: ({ context, event }) => ({ context: { ...context, name: event.name } }) }
on: { cancel: undefined }
always: { target: 'ready' }
after: { 1000: { target: 'idle' } }
onDone: { target: 'success' }
onError: { target: 'failure' }
```
