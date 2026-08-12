---
title: Why state machines?
description: Learn how explicit states make application behavior easier to understand.
---

Application logic is often described with values that can contradict each other.

```ts
const request = {
  isLoading: false,
  hasData: true,
  hasError: true
};
```

Is this request successful or failed? The object allows both at the same time. Every consumer has to decide what the combination means.

A state machine makes the status explicit:

```ts
const requestMachine = createMachine({
  initial: 'idle',
  states: {
    idle: { on: { load: { target: 'loading' } } },
    loading: {
      on: {
        succeed: { target: 'success' },
        fail: { target: 'failure' }
      }
    },
    success: {},
    failure: { on: { retry: { target: 'loading' } } }
  }
});
```

The request is in one state at a time. A `retry` event only has meaning in the `failure` state. The model documents the allowed behavior and rejects behavior you did not define.

## Benefits of explicit states

- **Impossible states stay impossible.** The request cannot be both successful and failed.
- **Events have local meaning.** You can see which events each state accepts.
- **Changes are easier to review.** New behavior appears as a new state or transition.
- **Tests follow the model.** Test states and transitions instead of combinations of flags.
- **Behavior can be visualized.** States and transitions form a statechart.

State machines do not remove complexity. They make it visible and give it a structure.

## Real examples

An online payment may be `idle`, `authorizing`, `confirmed` or `declined`. While it is `authorizing`, a second `submit` event can be ignored. A `retry` event only applies after the payment is declined.

A video call may be `joining`, `connected`, `reconnecting` or `ended`. The UI, timers and network effects can follow the current state instead of checking several connection flags.

These models answer two questions in one place:

- What can happen now?
- What should happen next?

## When not to use a state machine

Do not add a state machine only to replace a value. A counter, an open menu and a single text field may be clearer as ordinary state. Use a machine when the rules between states are the important part of the problem.
