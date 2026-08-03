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

Use an array to invoke more than one actor. Set `id` when another action needs to address the child.

## TypeScript

Provide named actor logic through `setup({ actors })`. XState checks `src` and `input` against that logic.

## Invoke cheatsheet

```ts
invoke: {
  id: 'request',
  src: requestLogic,
  input: ({ context }) => context.request,
  onDone: { target: 'success' },
  onError: { target: 'failure' }
}
```
