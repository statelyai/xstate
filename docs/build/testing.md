---
title: Test XState logic
description: Test state transitions, actor behavior and async outcomes.
---

Test observable behavior: the event sent, the resulting snapshot and effects at system boundaries.

```ts
test('pauses while playing', () => {
  const player = createActor(playerMachine).start();
  player.send({ type: 'play' });
  player.send({ type: 'pause' });
  expect(player.getSnapshot().matches('paused')).toBe(true);
});
```

Test forbidden behavior too.

```ts
test('does not pause while stopped', () => {
  const player = createActor(playerMachine).start();
  player.send({ type: 'pause' });
  expect(player.getSnapshot().matches('stopped')).toBe(true);
});
```

Use `waitFor(...)` for async outcomes. Provide fake actor logic for network, clock and storage boundaries.

Use `getInitialSnapshot(...)` and `getNextSnapshot(...)` when a test only needs pure transition results. Start an actor when the test covers effects, child actors or subscriptions.

For an order workflow, test the successful payment path and a declined payment retry. For an upload, test completion and cancellation while the request is active.
