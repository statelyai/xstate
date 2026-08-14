---
title: Test Solid components with actors
description: Test components that run XState logic with Solid Testing Library.
---

Test the machine and the component separately.

Machine behavior (which event leads to which state) is tested without Solid: start an actor, send events, assert on the snapshot. See [Test XState logic](../testing.md). What is left for a component test is the wiring: whether the click sends the event, and whether the snapshot reaches the DOM.

`@xstate/solid` is itself tested with [Solid Testing Library](https://github.com/solidjs/solid-testing-library) and Vitest.

## Rendering a component

```tsx
import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import { MediaPlayer } from './MediaPlayer';

test('plays and pauses', async () => {
  render(() => <MediaPlayer />);

  fireEvent.click(screen.getByText('Play'));

  await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('playing'));
});
```

`render(...)` takes a function returning JSX, which gives the component its own reactive root and cleanup. Use `waitFor(...)` or `findBy...` for anything that settles asynchronously, such as an invoked request.

Because the snapshot is a store, a test can also count evaluations inside a memo and assert that an unrelated transition does not re-run it.

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

```tsx
import { SimulatedClock } from 'xstate';

const clock = new SimulatedClock();

render(() => <RetryBanner clock={clock} />);

clock.increment(5000); // fire the `after: { 5000: ... }` transition
```

The component passes the prop straight through: `useActor(retryMachine, { clock: props.clock })`. In production the prop is omitted and the real clock is used.

## Restoring a persisted snapshot in a test

Drive a real actor to the state you want, persist it, then render the component with it as a prop.

```tsx
const actorRef = createActor(testMachine).start();
actorRef.send({ type: 'upload', file });

render(() => (
  <UploadPanel
    persistedState={JSON.parse(JSON.stringify(actorRef.getPersistedSnapshot()))}
  />
));
```

## Testing cheatsheet

```ts
render(() => <Component />);
fireEvent.click(screen.getByText('Play'));
await waitFor(() => expect(el.textContent).toBe('done'));

machine.provide({ actors: { uploadFile: createAsyncLogic({ run: fake }) } });
new SimulatedClock().increment(1000);
```
