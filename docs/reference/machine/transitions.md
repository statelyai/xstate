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

## TypeScript

Transition targets are checked against authored state paths. Event schemas narrow `event` inside transition functions.

## Transitions cheatsheet

```ts
on: { submit: { target: 'loading' } }
always: { target: 'ready' }
after: { 1000: { target: 'idle' } }
onDone: { target: 'success' }
onError: { target: 'failure' }
```
