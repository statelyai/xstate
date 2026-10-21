---
'xstate': major
---

Pending timers are a list, and no generated timer ids exist.

| Where | Before | After |
| --- | --- | --- |
| `snapshot.timers` (in memory and persisted) | record keyed by id | list in scheduling order |
| `after`, state `timeout`, invoke `timeout` timers | generated `id` (`xstate.after.<delay>.<stateId>`, `xstate.timeout.state.<stateId>`, …) | no `id`; identified by their event |
| delayed raise/send without an `id` | generated `xstate.timer.auto.<n>` | `seq` (the actor's sequence number) |
| `ActorSystemRuntime.scheduleTimer` / `cancelTimer` | `(source, id, delay)` / `(source, id)` | `(source, timer, delay)` / `(source, timer)` with a `TimerKey` |
| timer firing input | `{ type: 'xstate.timer', id }` | `{ type: 'xstate.timer', ...timer }` |
| `@xstate.cancel` effect and descriptor | `id` | the cancelled `TimerKey` fields (`id`, `seq` or `event`) |
| system snapshot `timers` | record; `SystemTimer.id` | list; `SystemTimer.event` is the firing input; select by `occurrence` |

A `TimerKey` is `{ id }`, `{ seq }` or, for a built-in timer, `{ event }` with the event identity (`{ type, stateId, delay }` for `xstate.after`, `{ type, stateId }` for `xstate.timeout.state`, `{ type, actorId }` for `xstate.timeout.actor`). Durable hosts key timers by `source.address` plus the key.

`enq.cancel(...)` also accepts a `TimerKey`, which cancels a built-in timer:

```ts
enq.cancel({
  event: { type: 'xstate.after', stateId: 'machine.waiting', delay: 1000 }
});
```

Snapshots persisted with the old `timers` record are not read on restore.
