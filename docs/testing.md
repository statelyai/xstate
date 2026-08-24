---
title: Test XState logic
description: Test state transitions, actor behavior and async outcomes.
---

Test observable behavior: the event sent, the resulting snapshot and effects at system boundaries. Every test has the same three parts: create the actor, send events, and assert on the snapshot.

```ts
test('pauses while playing', () => {
  const player = createActor(playerMachine).start();
  player.send({ type: 'play' });
  player.send({ type: 'pause' });
  expect(player.getSnapshot().matches('paused')).toBe(true);
});
```

Test forbidden behavior too. The events a machine ignores are part of its behavior.

```ts
test('does not pause while stopped', () => {
  const player = createActor(playerMachine).start();
  player.send({ type: 'pause' });
  expect(player.getSnapshot().matches('stopped')).toBe(true);
});
```

## Pure transitions

When a test only needs the result of a transition, calculate it without starting an actor. `initialTransition(...)` and `transition(...)` run no effects and start no children, so they are the fastest way to cover guards and context updates. Each returns a `[snapshot, actions]` tuple.

```ts
test('rejects an email without an @', () => {
  const [start] = initialTransition(formMachine);
  const [atEmail] = transition(formMachine, start, {
    type: 'next',
    value: 'Ada'
  });
  const [rejected] = transition(formMachine, atEmail, {
    type: 'next',
    value: 'nope'
  });

  expect(rejected.value).toBe('email');
  expect(rejected.context.email).toBe('');
});
```

Start an actor when the test covers effects, invoked children, delays or subscriptions.

## Replace boundaries with fakes

`machine.provide(...)` returns the same machine with different implementations. Swap the actors that reach the network for logic that resolves what the test needs, and leave every state and transition untouched.

```ts
import { createAsyncLogic, waitFor } from 'xstate';

const machineWithFakes = orderMachine.provide({
  actors: {
    chargeCard: createAsyncLogic({ run: async () => ({ id: 'ch_1' }) })
  }
});

test('confirms an order once the card is charged', async () => {
  const order = createActor(machineWithFakes).start();
  order.send({ type: 'submit' });

  const snapshot = await waitFor(order, (s) => s.matches('confirmed'), {
    timeout: 1_000
  });
  expect(snapshot.context.chargeId).toBe('ch_1');
});
```

Test the failure path the same way, with fake logic that throws instead of resolving. Always pass a `timeout` to `waitFor(...)`. Without one it waits forever, so a broken machine hangs the test suite instead of failing the test.

## Control time

Delays and timeouts do not need real time. Pass a `SimulatedClock` and move it forward yourself.

```ts
import { SimulatedClock } from 'xstate';

test('retries after the backoff', () => {
  const clock = new SimulatedClock();
  const request = createActor(requestMachine, { clock }).start();

  request.send({ type: 'fail' });
  expect(request.getSnapshot().matches('waitingToRetry')).toBe(true);

  clock.increment(1_000);
  expect(request.getSnapshot().matches('loading')).toBe(true);
});
```

`clock.increment(ms)` advances by a duration and `clock.set(ms)` moves to an absolute time; both fire every timer that has come due. `provide({ delays: { backoff: 0 } })` is the blunter alternative when the test cares that a retry happens, not when.

## Emitted events

Emitted events are delivered to external listeners, so assert on them with `actor.on(...)`.

```ts
test('emits when a track starts', () => {
  const played: string[] = [];
  const player = createActor(playerMachine).start();
  player.on('played', (event) => played.push(event.trackId));

  player.send({ type: 'play' });
  expect(played).toEqual(['track-1']);
});
```

## Persistence round-trips

A workflow that is restored on every request should be tested the way it runs. Persist, restore and continue:

```ts
test('resumes an order from its persisted snapshot', () => {
  const first = createActor(orderMachine).start();
  first.send({ type: 'submit' });
  const persisted = JSON.parse(JSON.stringify(first.getPersistedSnapshot()));
  first.stop();

  const second = createActor(orderMachine, { snapshot: persisted }).start();
  second.send({ type: 'confirm' });
  expect(second.getSnapshot().matches('confirmed')).toBe(true);
});
```

Serializing through JSON matters: it catches context that cannot survive a database round-trip, such as a class instance or an open connection.

## What to cover

For an order workflow, test the successful payment path and a declined payment retry. For an upload, test completion and cancellation while the request is active. For a form, test one valid submission and each rule that blocks one.

## What next?

- [Look up `waitFor`, `transition` and `SimulatedClock`](utilities.md).
- [Swap implementations with `provide(...)`](setup-and-provide.md).
- [Read what a snapshot contains](snapshots.md).
- [Diagnose a machine that is not behaving](troubleshooting.md).
