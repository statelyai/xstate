---
'xstate': major
---

Serialized actor identity uses one shape everywhere: `{ $actor: address }`, with an optional string `incarnation`.

| Where                                          | Before                                          | After                                  |
| ---------------------------------------------- | ----------------------------------------------- | -------------------------------------- |
| `actor.toJSON()`, `SerializedActorRef`         | `{ xstate$type: 'actorRef', id, address, src }` | `{ $actor: address }`                  |
| Actor refs in persisted `context`              | `{ xstate$type: 'actorRef', id, address? }`     | `{ $actor: address }`                  |
| Effect descriptor `source`/`actor`/`target`    | address string (+ `incarnation` on `sendTo`)    | `{ $actor: address, incarnation? }`    |
| System snapshot `incarnation`                  | `number`                                        | `string`                               |
| `SystemActorState.logic`                       | `logic`                                         | `src`                                  |
| System dead-letter effect `kind`               | `'deadLetter'`                                  | `'builtin'` (type `@xstate.deadLetter`) |
| Persisted timer start                          | `startedAt`                                     | `scheduledAt`                          |
| Persisted snapshot top-level `version`         | mirror of `machine.version`                     | removed; use `machine.version`         |

Snapshots persisted with the old `xstate$type` actor refs, `startedAt` timers, or a top-level `version` still restore.
