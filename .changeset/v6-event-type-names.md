---
'xstate': major
---

Built-in event and effect type strings follow one rule: events delivered to logic use the `xstate.` prefix, and effect types use the `@xstate.` prefix. Inspection records (`@xstate.actor`, `@xstate.transition`) are unchanged.

| Before                               | After                    | Kind   |
| ------------------------------------ | ------------------------ | ------ |
| `@xstate.init`                       | `xstate.init`            | event  |
| `@xstate.stop` (sent to a stopping actor) | `xstate.stop`       | event  |
| `xstate.timeout`                     | `xstate.timeout.state`   | event  |
| `xstate.system.cancelEffect`         | `@xstate.cancelEffect`   | effect |
| `xstate.logic.cleanup`               | `@xstate.cleanup`        | effect |
| `xstate.logic.effect`                | `@xstate.effect`         | effect |
| `xstate.log` (system effect)         | `@xstate.log`            | effect |

Built-in guard types in `MachineJSON` are source keys, not events, so they use the `@xstate.` prefix:

| Before           | After             |
| ---------------- | ----------------- |
| `xstate.not`     | `@xstate.not`     |
| `xstate.stateIn` | `@xstate.stateIn` |

In development, action, guard, actor and delay source names that start with `xstate.` or `@xstate.` throw. `machineFromJSON` also rejects JSON-defined `actions`, `guards` and `delays` with those names.

The stop-child effect stays `@xstate.stop`. Helper actors created by `enq.listen()` and `enq.subscribeTo()` use the `@xstate.listener` and `@xstate.subscription` source keys, so their ids look like `@xstate.listener:0`. In development, spawned sources whose id starts with `xstate.` or `@xstate.` throw.

Suffixed lifecycle event types are no longer matched. Key transitions by the category type and select the payload with `matches`:

```diff
  on: {
-   'xstate.done.actor.job': { target: 'complete' }
+   'xstate.done.actor': { matches: { actorId: 'job' }, target: 'complete' }
  }
```

This applies to `xstate.done.actor.<id>`, `xstate.error.actor.<id>`, `xstate.snapshot.<id>` (now `xstate.snapshot.actor`), `xstate.done.state.<id>`, `xstate.after.<delay>.<id>`, `xstate.timeout.<id>` and `xstate.timeout.actor.<id>`, both as transition keys and as sent event types.
