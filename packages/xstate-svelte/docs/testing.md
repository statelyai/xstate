---
title: Test Svelte components with actors
description: Test components that run XState logic with Svelte Testing Library.
---

Test the machine and the component separately.

Machine behavior (which event leads to which state) is tested without Svelte: start an actor, send events, assert on the snapshot. See [Test XState logic](../testing.md). What is left for a component test is the wiring: whether the click sends the event, and whether the snapshot reaches the DOM.

`@xstate/svelte` is itself tested with [Svelte Testing Library](https://testing-library.com/docs/svelte-testing-library/intro) and Vitest.

## Rendering a component

```ts
import { fireEvent, render } from '@testing-library/svelte';
import MediaPlayer from './MediaPlayer.svelte';

test('plays and pauses', async () => {
  const { getByText, findByText } = render(MediaPlayer);

  await fireEvent.click(getByText('Play'));

  await findByText('playing');
});
```

`fireEvent` returns a promise that resolves after Svelte flushes, so `await` it before asserting. Use `findBy...` for anything that settles asynchronously, such as an invoked request.

Props are passed as the second argument: `render(UploadPanel, { fileId: 'abc' })`. To assert on a selection without markup, read it with `get(...)` from `svelte/store`.

## Replace real work with fake actor logic

`machine.provide(...)` swaps named implementations without touching the machine's states or transitions. This is how the package's own tests avoid real network calls.

```ts
// uploadMachine.ts — the boundary is a named actor
const uploadMachine = createMachine({
  actors: {
    uploadFile: createAsyncLogic<string, { file: File }>({
      run: ({ input, signal }) =>
        fetch('/upload', { method: 'POST', body: input.file, signal }).then(
          (res) => res.text()
        )
    })
  },
  initial: 'idle',
  states: {
    idle: { on: { upload: { target: 'uploading' } } },
    uploading: {
      invoke: {
        src: 'uploadFile',
        input: ({ event }) => ({ file: event.file }),
        onDone: { target: 'done' },
        onError: { target: 'failed' }
      }
    },
    done: {},
    failed: { on: { retry: { target: 'uploading' } } }
  }
});
```

```ts
const testMachine = uploadMachine.provide({
  actors: {
    uploadFile: createAsyncLogic({ run: async () => '/files/1.png' })
  }
});
```

Have the component accept the machine as a prop, or export a factory, so the test can pass the provided machine in. Then the component under test is the real one and only the boundary is fake.

Provide rejecting logic to test the failure path:

```ts
createAsyncLogic({ run: async () => Promise.reject(new Error('offline')) });
```

## Control time with SimulatedClock

Delayed transitions and timeouts read the actor's `clock` option. Pass a `SimulatedClock` as a prop and advance it by hand instead of waiting.

```ts
import { SimulatedClock } from 'xstate';

const clock = new SimulatedClock();

render(RetryBanner, { clock });

clock.increment(5000); // fire the `after: { 5000: ... }` transition
```

The component passes the prop straight through: `useActor(retryMachine, { clock })`. In production the prop is omitted and the real clock is used.

## Restoring a persisted snapshot in a test

Drive a real actor to the state you want, persist it, then render the component with it as a prop. The package's own tests use this pattern.

```ts
const actorRef = createActor(testMachine).start();
actorRef.send({ type: 'upload', file });

render(UploadPanel, {
  persistedState: JSON.parse(JSON.stringify(actorRef.getPersistedSnapshot()))
});
```

## Testing cheatsheet

```ts
render(Component, { props });
await fireEvent.click(getByText('Play'));
await findByText('done');

machine.provide({ actors: { uploadFile: createAsyncLogic({ run: fake }) } });
new SimulatedClock().increment(1000);
```
