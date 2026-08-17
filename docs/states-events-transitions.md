---
title: States, events and transitions
description: Learn the three parts of a state machine.
---

A state machine describes states and the events that move the machine between them.

## States

A state describes how something behaves now. Good state names describe a mode or status, such as `loading`, `playing` or `awaitingPayment`.

```ts
const machine = createMachine({
  initial: 'idle',
  states: {
    idle: {},
    loading: {},
    success: {},
    failure: {}
  }
});
```

The initial state is entered when an actor starts.

## Events

An event describes something that happened.

```ts
actor.send({ type: 'load' });
actor.send({ type: 'cancel' });
actor.send({ type: 'search', query: 'state machines' });
```

Events are objects with a `type` property. They can also contain data.

## Transitions

A transition describes how a state responds to an event.

```ts
loading: {
  on: {
    cancel: { target: 'idle' },
    resolved: { target: 'success' },
    rejected: { target: 'failure' }
  }
}
```

The same event can have different meanings in different states. An event with no matching transition is ignored.

## Transition functions

Use a transition function when the result depends on context or event data.

```ts
on: {
  submit: ({ context }) => {
    if (!context.email) return;
    return { target: 'submitting' };
  }
}
```

Returning `undefined` prevents the transition. Keep transition functions deterministic.

## Real examples

In a checkout, `submit` can move `reviewing` to `paying`. The same event is ignored while payment is already in progress. `paymentSucceeded` and `paymentFailed` only matter in `paying`.

In a media player, `play` can move `paused` to `playing`. While the player is `buffering`, `play` may do nothing until a `bufferReady` event arrives.

Use event data for facts about what happened:

```ts
actor.send({ type: 'paymentFailed', reason: 'card_declined' });
actor.send({ type: 'bufferReady', duration: 184 });
```
