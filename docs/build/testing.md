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
