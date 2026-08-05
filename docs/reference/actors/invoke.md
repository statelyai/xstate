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

Invoked actors belong to the state that starts them:

- entering the state starts the actor
- leaving the state stops it
- re-entering the state stops the old actor and starts a new one

Use an actor instead of an action when work is async, can be canceled, sends snapshots or affects the next state. Common examples are payment authorization and file uploads.

`onDone` receives final output. `onError` receives an unhandled error. `onSnapshot` handles intermediate snapshots.

```ts
invoke: {
  src: uploadMachine,
  onSnapshot: ({ context, event }) => ({
    context: {
      ...context,
      progress: event.snapshot.context.progress
    }
  }),
  onDone: { target: 'complete' },
  onError: { target: 'failed' }
}
```

## TypeScript

Provide named actor logic through `setup({ actors })`. XState checks `src` and `input` against that logic.

## Invoke cheatsheet

```ts
invoke: {
  id: 'request',
  src: requestLogic,
  input: ({ context }) => context.request,
  onDone: { target: 'success' },
  onError: { target: 'failure' },
  onSnapshot: ({ event }) => ({ context: { snapshot: event.snapshot } })
}
```
