---
'xstate': major
'@xstate/codemod': minor
---

Public names are consistent before the beta. The old names are not kept as aliases.

| Before                                                       | After                                                    |
| ------------------------------------------------------------ | -------------------------------------------------------- |
| `serializeMachine(machine)`                                  | `machineToJSON(machine)` (returns `MachineJSON`)         |
| `createMachineFromConfig(json, sources)`                     | `machineFromJSON(json, sources)`                         |
| `createLogic`                                                | `createStepLogic`                                        |
| `LogicActorLogic`, `LogicActorRef`, `LogicSnapshot`          | `StepActorLogic`, `StepActorRef`, `StepSnapshot`         |
| `LogicConfig`, `LogicArgs`, `LogicEnqueue`, `LogicFunction`  | `StepLogicConfig`, `StepLogicArgs`, `StepLogicEnqueue`, `StepLogicFunction` |
| `LogicPatch`, `LogicEffectState`                             | `StepPatch`, `StepEffectState`                           |
| `LogicEffect`                                                | `ExecutableEffect`                                       |
| `EffectDescriptor`, `getEffectDescriptor`                    | `ExecutableEffectDescriptor`, `describeExecutableEffect` |
| `checkStateIn(snapshot, value)`                              | `snapshot.matches(value)`                                |
| state node `contextSchema`                                   | state node `schemas: { context }`                        |
| `StrictSetupStateTargetsFlag`, `StrictSetupStateTargetsMarker` | `StrictSetupStateTargetsMarker`, `StrictSetupStateMarkers` |

`machineConfigToJSON(config)` is unchanged and now returns `MachineJSON`.

Removed exports: `listenerLogic`, `subscriptionLogic` (use `createListenerLogic()`/`createSubscriptionLogic()`), `__unsafe_getAllOwnEventDescriptors` (use `getAllOwnEvents` from `xstate/graph`), `toObserver`, `pathToStateValue`, `SpecialTargets`, and the `devTools` actor option type.

The `report-removed-apis` codemod reports `toObserver`, `pathToStateValue` and `SpecialTargets`, and its `stateIn` hint suggests `snapshot.matches(...)`.

```diff
- import { createLogic, serializeMachine } from 'xstate';
+ import { createStepLogic, machineToJSON } from 'xstate';
```
