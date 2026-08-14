---
title: Test Vue components with actors
description: Test components that run XState logic with Vue Testing Library.
---

Test the machine and the component separately.

Machine behavior (which event leads to which state) is tested without Vue: start an actor, send events, assert on the snapshot. See [Test XState logic](../testing.md). What is left for a component test is the wiring: whether the click sends the event, and whether the snapshot reaches the DOM.

`@xstate/vue` is itself tested with [Vue Testing Library](https://testing-library.com/docs/vue-testing-library/intro) and Vitest.

## Rendering a component

```ts
import { fireEvent, render, waitFor } from '@testing-library/vue';
import MediaPlayer from './MediaPlayer.vue';

test('plays and pauses', async () => {
  const { getByText, getByTestId } = render(MediaPlayer);

  await fireEvent.click(getByText('Play'));

  await waitFor(() => expect(getByTestId('status').textContent).toBe('playing'));
});
```

`fireEvent` returns a promise that resolves after Vue flushes, so `await` it before asserting. Use `waitFor(...)` or `findBy...` for anything that settles asynchronously, such as an invoked request.

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

Delayed transitions and timeouts read the actor's `clock` option. Pass a `SimulatedClock` and advance it by hand instead of waiting.

```ts
import { SimulatedClock } from 'xstate';

const clock = new SimulatedClock();

render(RetryBanner, { props: { clock } });

clock.increment(5000); // fire the `after: { 5000: ... }` transition
```

The component passes the prop straight through: `useActor(retryMachine, { clock: props.clock })`. In production the prop is omitted and the real clock is used.

## Restoring a persisted snapshot in a test

Build the state you want by driving a real actor, persist it, then render the component with it as a prop.

```ts
const actorRef = createActor(testMachine).start();
actorRef.send({ type: 'upload', file });
const persisted = actorRef.getPersistedSnapshot();

render(UploadPanel, { props: { persistedState: persisted } });
```

Passing `JSON.parse(JSON.stringify(persisted))` instead checks that the snapshot survives the round trip a real page reload would put it through.

## Testing cheatsheet

```ts
render(Component, { props });
await fireEvent.click(getByText('Play'));
await waitFor(() => expect(el.textContent).toBe('done'));

machine.provide({ actors: { fetchData: createAsyncLogic({ run: fake }) } });
new SimulatedClock().increment(1000);
```
