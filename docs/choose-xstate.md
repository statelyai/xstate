---
title: Choose XState
description: Decide whether to use XState, XState Store, or ordinary application code.
---

XState, XState Store and ordinary application code each suit a different kind of logic. Use the one that matches the behavior you are describing.

## Use XState

Use XState when behavior depends on both the current state and an event. XState is a good fit when your logic includes:

- steps that must happen in a specific order
- async work with loading, success, failure, cancellation or retry states
- rules about which events are allowed
- parallel or nested behavior
- long-running or persisted workflows
- actors that communicate with each other

Common examples include:

- a checkout with payment, confirmation, failure and retry states
- a file upload that can finish, fail, time out or be canceled
- a media player with playback and volume controls
- an order workflow restored from storage between requests

## Use XState Store

Use [`@xstate/store`](../../xstate-store/v4/quick-start.md) when you need simple event-based state management. A store is a good fit when events update data without a statechart.

```ts
import { createStore } from '@xstate/store';

const counter = createStore({
  context: { count: 0 },
  on: {
    increment: (context) => ({ count: context.count + 1 })
  }
});
```

A shopping cart, editable table or shared set of filters often fits a store. The important part is how events update data, not which events are allowed in each state.

## Use ordinary code

Use local variables, functions or framework state when the behavior is small and has few meaningful transitions. A menu that is only open or closed and a text field that only stores its value do not usually need a state machine.

Start with events when you are unsure. If the logic becomes difficult to change, list its possible states and transitions. That list will show whether a state machine would make the behavior clearer.
