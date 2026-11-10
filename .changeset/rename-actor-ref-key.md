---
'xstate': major
'@xstate/test': major
---

Serialized output no longer uses field names that start with `$` or `_`. Stores such as Convex reject both prefixes, and MongoDB restricts `$`-prefixed field names, so persisted snapshots, `systemTransition` snapshots and effect descriptors could not be stored without rewriting them.

| Before                    | After                    | Where                                                                                                      |
| ------------------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `{ $actor, incarnation }` | `{ '@actor', incarnation }` | `SerializedActorRef`: persisted context, `systemTransition` snapshots, effect descriptors, `sendTo` targets, dead letters |
| `_nextTimerId`            | `nextTimerId`            | Persisted snapshots, `systemTransition` snapshots                                                          |
| `_nextActorIds`           | `nextActorIds`           | Persisted snapshots, `systemTransition` snapshots                                                          |
| `_stateInputs`            | `stateInputs`            | `systemTransition` snapshots (persisted snapshots already used `stateInputs`)                              |
| `{ $error, message }`     | `{ '@error', message }`  | `systemTransition` snapshots, `@xstate/test` traces                                                        |
| `$stateNode`, `$systemMapper` | `@stateNode`, `@systemMapper` | `systemTransition` snapshots                                                                        |

```ts
// Before
{ $actor: 'order/worker', incarnation: 'a:1' }
// After
{ '@actor': 'order/worker', incarnation: 'a:1' }
```

`snapshot.toJSON()` no longer includes the private `_nextTimerId` and `_nextActorIds` counters.

Snapshots written by `6.0.0-beta.1` with the old field names still restore: `restoreActor`, `restoreMachineSnapshot` and `systemTransition` read both shapes. New snapshots use only the new names. Schemas that validate persisted snapshots (for example with `machineVersions`) must use the new names.
