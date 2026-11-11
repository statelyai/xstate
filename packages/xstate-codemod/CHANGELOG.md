# @xstate/codemod

## 0.1.0-beta.2

### Patch Changes

- 3cbcc3f: Serialized output no longer uses field names that start with `$` or `_`. Stores such as Convex reject both prefixes, and MongoDB restricts `$`-prefixed field names, so persisted snapshots, `systemTransition` snapshots and effect descriptors could not be stored without rewriting them.
  
  | Before                    | After                    | Where                                                                                                      |
  | ------------------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------- |
  | `{ $actor: address, incarnation }` | `{ '@actor': address, incarnation }` | `SerializedActorRef`: persisted context, `systemTransition` snapshots, effect descriptors, `sendTo` targets, dead letters, `@xstate/effect` actor `toJSON()` |
  | `_nextTimerId`            | `nextTimerId`            | Persisted snapshots, `systemTransition` snapshots                                                          |
  | `_nextActorIds`           | `nextActorIds`           | Persisted snapshots, `systemTransition` snapshots                                                          |
  | `_stateInputs`            | `stateInputs`            | `systemTransition` snapshots (persisted snapshots already used `stateInputs`)                              |
  | `{ $error: name, message }` | `{ '@error': name, message }` | `systemTransition` snapshots, `@xstate/test` traces                                                        |
  | `{ $stateNode: id }`, `{ $systemMapper: key }` | `{ '@stateNode': id }`, `{ '@systemMapper': key }` | `systemTransition` snapshots                                                                        |
  
  ```ts
  // Before
  { $actor: 'order/worker', incarnation: 'a:1' }
  // After
  { '@actor': 'order/worker', incarnation: 'a:1' }
  ```
  
  `snapshot.toJSON()` no longer includes the private `_nextTimerId` and `_nextActorIds` counters.
  
  Snapshots written by `6.0.0-beta.1` with the old field names still restore: `restoreActor`, `restoreMachineSnapshot` and `systemTransition` read both shapes. New snapshots use only the new names. Schemas that validate persisted snapshots (for example with `machineVersions`) must use the new names.
- Updated dependencies [c558afa]
- Updated dependencies [c70dd85]
- Updated dependencies [975ba72]
- Updated dependencies [0ebc550]
- Updated dependencies [bbc8797]
- Updated dependencies [757b605]
- Updated dependencies [3cbcc3f]
- Updated dependencies [bcd3840]
  - xstate@6.0.0-beta.2

## 0.1.0-beta.1

### Minor Changes

- 1148d89: `xstate-codemod migrate` accepts `--json`, which prints one JSON report to stdout. The command exits with code `2` when manual migration is needed, and the report lists each site under `manualSites` with its file, line, column, API, and hint.
  
  A new report transform, `report-suffixed-lifecycle-events`, flags `on` keys written as `xstate.done.state.<id>`, `xstate.done.actor.<id>`, `xstate.error.actor.<id>`, or `xstate.after.<delay>.<id>`. v6 raises the plain event type with the id in a field, so those transitions never fire after migration. Another report transform, `report-action-shapes`, flags non-function `entry` and `exit` values, transition arrays, and transition `actions`, `guard`, and `cond` keys, which v6 rejects.
  
  A new report transform, `report-implementations`, flags a second `createMachine` argument, which v6 ignores.
  
  A new transform, `lower-actions`, rewrites v5 transitions with `actions` or `guard`, transition arrays, and `entry`/`exit` lists as v6 functions, converting `assign`, `enqueueActions`, `raise`, `sendTo`, `sendParent`, `forwardTo`, `emit`, `log`, `cancel`, `stopChild`, `spawnChild`, `and`, `or`, `not`, and `stateIn`, including named implementations and module-level constants defined in the same file. Named actions and guards keep their v5 signatures, and a named `assign` action becomes a function that returns a context patch. It also moves an object-literal second `createMachine` argument into the config and rewrites `fromPromise(fn)` as `createAsyncLogic({ run: fn })`. Code it cannot rewrite is left unchanged and reported.
  
  ```ts
  // before
  on: { INC: { target: 'active', guard: 'canInc', actions: assign({ count: ({ context }) => context.count + 1 }) } }
  // after
  on: {
    INC: (args) => {
      if (!args.guards.canInc(args)) return;
      return { target: 'active', context: { count: args.context.count + 1 } };
    }
  }
  ```
  
  `types-to-schemas` converts the per-key form `types: { context: {} as C, events: {} as E }`, builds an events map from same-file type aliases, and writes `events: types<E>()` for other event types instead of leaving `types` in place.
  
  New `baseline` and `verify` commands check that a migrated machine behaves like the v5 original. `baseline` records a trace of generated event sequences under XState v5, and `verify` replays them against the v6 module and reports the diffs.
  
  `baseline` and `verify` accept `--input <file>`, a JSON value passed as the machine's `input`. While a machine runs, `Date.now()`, `performance.now()`, and `Math.random()` return simulated, seeded values, so machines that store them in `context` compare equal, and a v5 root actor's `sendParent` error is classified as the intentional `root-send-parent` delta. `--no-simple-paths` skips the graph's simple paths when `baseline` times out.
  
  ```bash
  npx @xstate/codemod baseline src/checkout.ts --out .xstate-migrate/checkout.json
  npx @xstate/codemod migrate src/checkout.ts --json
  # fix the reported manualSites
  npx @xstate/codemod verify --baseline .xstate-migrate/checkout.json src/checkout.ts
  ```
  
  `migrate` reports string literals that name v5 inspection event types (`@xstate.snapshot`, `@xstate.event`, `@xstate.action`, `@xstate.microstep`, `@xstate.deadletter`), which v6 never emits.

### Patch Changes

- Updated dependencies [599ec3c]
  - xstate@6.0.0-beta.1

## 0.1.0-beta.0

### Patch Changes

- 6cf6982: XState v6 enters beta. No further breaking changes are planned for APIs tagged `@public`; any that are needed will be called out with a migration path. APIs tagged `@experimental` may still change.

## 0.1.0-alpha.4

### Minor Changes

- 39d3b5c: Added the `report-id-path-targets` transform. It reports, without rewriting, `#a.b` targets and `matches('#a.b')` or `stateIn('#a.b')` arguments that are not whole state ids of the machine config that contains them (references outside a machine config are always reported), since v6 resolves `#` targets by exact id only.
  
  ```ts
  // Reported: `flow` is an explicit id, and `flow.review` is not an id
  on: { review: { target: '#flow.review' } }
  // Not reported: the full implicit id
  on: { review: { target: '#shop.wizard.review' } }
  ```

### Patch Changes

- ceeebb0: `xstate-codemod migrate` renames `ActorRefFromLogic` imports and usages to `ActorRefFrom`.

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
