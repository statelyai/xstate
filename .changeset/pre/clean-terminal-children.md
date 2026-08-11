---
'xstate': patch
---

Machine snapshots now remove a child after processing that child's matching done or error event. Terminal actor events include a `sessionId` so a delayed event from an older child incarnation cannot remove a replacement with the same actor ID.

```ts
const child = snapshot.children.job;

const [nextSnapshot] = transition(machine, snapshot, {
  type: 'xstate.done.actor',
  actorId: 'job',
  sessionId: child.sessionId,
  output: result
});

nextSnapshot.children.job; // undefined
```

Persisted child session identities and the actor ID allocator are restored across JSON round-trips. Restoring a persisted child whose registered actor source is unavailable now produces an error snapshot instead of silently omitting the child.

```ts
// `persisted` contains a child whose registered source is not provided.
const restored = createActor(machineWithoutChildSource, {
  snapshot: persisted
});

restored.getSnapshot().status; // 'error'
```

Internal actor, state-completion, delayed, and timeout events now use stable category types. Their identity is carried in event payload fields and can be selected with `matches`:

```ts
const machine = createMachine({
  // ...
  on: {
    'xstate.done.actor': {
      matches: { actorId: 'job' },
      target: 'complete'
    }
  }
});

// Generated events use payload identity:
// { type: 'xstate.done.actor', actorId: 'job', sessionId, output }
// { type: 'xstate.done.state', stateId, output }
// { type: 'xstate.after', stateId, delay }
// { type: 'xstate.timeout', stateId }
// { type: 'xstate.timeout.actor', actorId, sessionId }
```
