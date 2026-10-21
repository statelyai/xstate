---
title: Test React components
description: Test components that run XState actors.
---

Test a component the way a user uses it: render it, fire events, assert on what is on screen. The actor is an implementation detail. Assert on rendered output, not on `snapshot.value`.

```tsx
import { fireEvent, render, screen } from '@testing-library/react';

test('plays and pauses', () => {
  render(<Player />);

  fireEvent.click(screen.getByRole('button', { name: 'Play' }));
  expect(screen.getByRole('button').textContent).toBe('Pause');
});
```

Test machine logic without React wherever you can. A transition, a guard or a retry policy is faster and clearer to test against a bare actor. See [test XState logic](../testing.md). Reserve component tests for what only React can break: rendering, events, and effects tied to mount and unmount.

## Replacing implementations

`machine.provide({ ... })` returns new logic with implementations swapped, leaving the machine's structure alone. Use it to stand in for network calls, timers and analytics.

```tsx
import { createAsyncLogic } from 'xstate';

const testMachine = checkoutMachine.provide({
  actors: {
    authorize: createAsyncLogic({ run: async () => ({ status: 'approved' }) })
  }
});

render(<Checkout logic={testMachine} />);
```

Accept the logic as a prop, or render it through a provider. Do not reach into a running actor from a test.

```tsx
await screen.findByText('Payment approved');
```

For a failure path, provide logic that throws. Guards and actions swap the same way, which is how you test a branch without constructing the state that would reach it naturally.

```tsx
playerMachine.provide({
  guards: { hasSubscription: () => false },
  actions: { track: analyticsSpy }
});
```

## Testing a `createActorContext` consumer

Components that use `Ctx.useSelector` or `Ctx.useActorRef` must render inside the provider, or the hook throws. Wrap them in the test, and use the `logic` prop to inject test logic.

```tsx
function renderWithProvider(ui: React.ReactNode, logic = checkoutMachine) {
  return render(
    <CheckoutContext.Provider logic={logic}>{ui}</CheckoutContext.Provider>
  );
}

test('shows the cart total', () => {
  renderWithProvider(<CartSummary />, testMachine);

  expect(screen.getByTestId('total').textContent).toBe('42');
});
```

Use `options` to start the provider's actor at a specific point instead of clicking through the flow.

```tsx
const actor = createActor(checkoutMachine).start();
actor.send({ type: 'next' });
const persisted = actor.getPersistedSnapshot();

render(
  <CheckoutContext.Provider options={{ snapshot: persisted }}>
    <PaymentStep />
  </CheckoutContext.Provider>
);
```

`options={{ input }}` does the same for logic whose starting state is derived from input.

## Time

Delays and [timeouts](../timeouts.md) go through the actor's clock. Fake timers are the simplest way to control them, because they also cover timers React itself uses. Advance them inside `act(...)` so React flushes the resulting renders.

```tsx
import { act } from '@testing-library/react';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

test('retries after the backoff', () => {
  render(<Upload />);

  act(() => {
    vi.advanceTimersByTime(310);
  });

  expect(screen.getByText('Retrying')).toBeTruthy();
});
```

`SimulatedClock` is the alternative when only one actor's time should move. Pass it as the `clock` [actor option](../create-actor.md#actor-options) and call `clock.increment(ms)` inside `act(...)`.

```tsx
const clock = new SimulatedClock();

render(<Upload clock={clock} />);
act(() => clock.increment(5_000));
```

## Async and StrictMode

Anything that sends events from outside React (a resolved promise, a subscription, a direct `actor.send(...)`) must be wrapped in `act(...)` so React can flush. For work that settles on its own, prefer `findBy*` queries, which retry until the element appears.

```tsx
act(() => actorRef.send({ type: 'increment' }));

expect(await screen.findByText('Upload complete')).toBeTruthy();
```

Run component tests under `React.StrictMode` as well as without it. StrictMode double-mounts, which surfaces actors that do not survive a stop and restart, and effects that assume they run once.

> **Warning:** Errors from an `error` snapshot are thrown during render by `useActor` and `useSelector`. Wrap the component in an error boundary in the test, or the failure surfaces as an unhandled render error instead of the assertion you wrote.

## Testing cheatsheet

```tsx
render(<Component />);
render(<Ctx.Provider logic={testLogic}>{ui}</Ctx.Provider>);
render(<Ctx.Provider options={{ input, snapshot }}>{ui}</Ctx.Provider>);

machine.provide({ actors, guards, actions, delays });

fireEvent.click(screen.getByTestId('submit'));
await screen.findByText('Done');
act(() => vi.advanceTimersByTime(1_000));
act(() => actorRef.send({ type: 'next' }));
```
