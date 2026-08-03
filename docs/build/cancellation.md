---
title: Cancel async work
description: Stop invoked async logic when the machine leaves its state.
---

Invoked actors follow the lifecycle of the state that invokes them. Leaving the state stops the actor.

```ts
const uploadFile = createAsyncLogic({
  run: async ({ input, signal }: { input: { file: File } }) => {
    const response = await fetch('/api/upload', {
      method: 'POST',
      body: input.file,
      signal
    });
    return response.json();
  }
});

const uploadMachine = createMachine({
  context: ({ input }: { input: { file: File } }) => ({ file: input.file }),
  initial: 'idle',
  states: {
    idle: { on: { upload: { target: 'uploading' } } },
    uploading: {
      invoke: {
        src: uploadFile,
        input: ({ context }) => ({ file: context.file }),
        onDone: { target: 'complete' },
        onError: { target: 'failed' }
      },
      on: { cancel: { target: 'idle' } }
    },
    complete: { type: 'final' },
    failed: { on: { retry: { target: 'uploading' } } }
  }
});
```

Sending `cancel` leaves `uploading`. XState aborts the async actor's `signal`. Pass that signal to APIs such as `fetch`.
