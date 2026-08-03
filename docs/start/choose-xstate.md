---
title: Choose XState
description: Decide whether to use XState, XState Store, or ordinary application code.
---

Use the smallest tool that clearly describes your logic.

## Use XState

Use XState when behavior depends on both the current state and an event. XState is a good fit when your logic includes:

- steps that must happen in a specific order
- async work with loading, success, failure, cancellation or retry states
- rules about which events are allowed
- parallel or nested behavior
- long-running or persisted workflows
- actors that communicate with each other

Forms, media players, checkout flows and backend workflows are common examples.

## Use XState Store

Use [`@xstate/store`](../../packages/xstate-store/README.md) when you need simple event-based state management. A store is a good fit when events update data without a statechart.

```ts
import { createStore } from '@xstate/store';

const counter = createStore({
  context: { count: 0 },
  on: {
    increment: (context) => ({ count: context.count + 1 })
  }
});
```

## Use ordinary code

Use local variables, functions or framework state when the behavior is small and has few meaningful transitions. A boolean that only controls whether a menu is open does not usually need a state machine.

Start with events when you are unsure. If the logic becomes difficult to change, list its possible states and transitions. That list will show whether a state machine would make the behavior clearer.
