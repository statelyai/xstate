# @xstate/codemod

## 0.1.0-alpha.3

### Minor Changes

- d2c518b: Public names are consistent before the beta. The old names are not kept as aliases.
  
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

## 0.1.0-alpha.2

### Minor Changes

- 1a5349a: The executable action object types are renamed to executable effect types, matching the `[snapshot, effects]` tuple that transitions return:
  
  | Before                                     | After                                       |
  | ------------------------------------------ | ------------------------------------------- |
  | `ExecutableActionObject`                   | `ExecutableEffect`                          |
  | `ExecutableActionObjectFromLogic`          | `ExecutableEffectFrom`                      |
  | `BaseExecutableActionObject`               | `BaseExecutableEffect`                      |
  | `CustomExecutableActionObject`             | `CustomExecutableEffect`                    |
  | `BuiltInExecutableActionObject`            | `BuiltInExecutableEffect`                   |
  | `<Kind>ExecutableActionObject`             | `<Kind>ExecutableEffect`                    |
  | `SpecialExecutableAction`                  | `SpecialExecutableEffect`                   |
  | `ToExecutableAction`                       | `ToExecutableEffect`                        |
  | `isBuiltInExecutableAction`                | `isBuiltInExecutableEffect`                 |
  
  `<Kind>` is `Start`, `Spawn`, `Raise`, `SendTo`, `Emit`, `Cancel`, `Stop`, `Terminate`, or `DeadLetter`. The old names are not kept as aliases.
  
  The `rename-imports` codemod renames the v5 `ExecutableActionObject`, `ExecutableActionsFrom`, `ExecutableSpawnAction`, `SpecialExecutableAction`, and `ToExecutableAction` imports to their new names. The other names, including `isBuiltInExecutableAction`, only existed in v6 alphas; rename them by hand.
  
  ```diff
  - import { isBuiltInExecutableAction, type ExecutableActionObject } from 'xstate';
  + import { isBuiltInExecutableEffect, type ExecutableEffect } from 'xstate';
  ```

## 0.1.0-alpha.1

### Patch Changes

- 69b6663: Generate valid event payload schemas across member separators and preserve escaped event names. Migration helpers now use runtime imports safely with namespace imports, type-only imports, aliases, and local binding collisions. Reject syntactically invalid migration output before saving it.

## 0.1.0-alpha.0

### Minor Changes

- d000747: Add `@xstate/codemod` and the `xstate migrate` command for migrating v5 sources to v6:

  ```sh
  npx xstate migrate "src/**/*.ts"
  # or preview without writing:
  npx xstate migrate "src/**/*.ts" --dry
  ```

  Automated transforms:
  - renames `interpret` → `createActor`, `Interpreter` → `Actor`, `fromCallback`/`fromObservable`/`fromEventObservable` → `createCallbackLogic`/`createObservableLogic`/`createEventObservableLogic`
  - wraps string transition targets into object form (`on: { EVT: 'a' }` → `on: { EVT: { target: 'a' } }`), including `after`, `always`, and invoke `onDone`/`onError`
  - converts `types: {} as {...}` to `schemas` with `types<T>()`, including inline event unions to the `schemas.events` map

  Usages that need structural rewrites (`assign`, `raise`, `sendTo`, `enqueueActions`, `fromPromise`, guard combinators, …) are detected and reported with file:line and a v6 replacement hint instead of being transformed.
