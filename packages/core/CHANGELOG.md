# xstate

## 4.10.0

### Minor Changes

- [`0133954`](https://github.com/davidkpiano/xstate/commit/013395463b955e950ab24cb4be51faf524b0de6e) [#1178](https://github.com/davidkpiano/xstate/pull/1178) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The types for the `send()` and `sendParent()` action creators have been changed to fix the issue of only being able to send events that the machine can receive. In reality, a machine can and should send events to other actors that it might not be able to receive itself. See [#711](https://github.com/davidkpiano/xstate/issues/711) for more information.

* [`a1f1239`](https://github.com/davidkpiano/xstate/commit/a1f1239e20e05e338ed994d031e7ef6f2f09ad68) [#1189](https://github.com/davidkpiano/xstate/pull/1189) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Previously, `state.matches(...)` was problematic because it was casting `state` to `never` if it didn't match the state value. This is now fixed by making the `Typestate` resolution more granular.

- [`dbc6a16`](https://github.com/davidkpiano/xstate/commit/dbc6a161c068a3e12dd12452b68a66fe3f4fb8eb) [#1183](https://github.com/davidkpiano/xstate/pull/1183) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Actions from a restored state provided as a custom initial state to `interpret(machine).start(initialState)` are now executed properly. See #1174 for more information.

### Patch Changes

- [`a10d604`](https://github.com/davidkpiano/xstate/commit/a10d604a6afcf39048b02be5436acdd197f16c2b) [#1176](https://github.com/davidkpiano/xstate/pull/1176) Thanks [@itfarrier](https://github.com/itfarrier)! - Fix passing state schema into State generic

* [`326db72`](https://github.com/davidkpiano/xstate/commit/326db725e50f7678af162626c6c7491e4364ec07) [#1185](https://github.com/davidkpiano/xstate/pull/1185) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an issue with invoked service not being correctly started if other service got stopped in a subsequent microstep (in response to raised or null event).

- [`c3a496e`](https://github.com/davidkpiano/xstate/commit/c3a496e1f92ec27db0643fd1ddc32d683db4e751) [#1160](https://github.com/davidkpiano/xstate/pull/1160) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Delayed transitions defined using `after` were previously causing a circular dependency when the machine was converted using `.toJSON()`. This has now been fixed.

* [`e16e48e`](https://github.com/davidkpiano/xstate/commit/e16e48e05e6243a3eacca58a13d3e663cd641f55) [#1153](https://github.com/davidkpiano/xstate/pull/1153) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an issue with `choose` and `pure` not being able to use actions defined in options.

- [`d496ecb`](https://github.com/davidkpiano/xstate/commit/d496ecb11b26011f2382d1ce6c4433284a7b3e9b) [#1165](https://github.com/davidkpiano/xstate/pull/1165) Thanks [@davidkpiano](https://github.com/davidkpiano)! - XState will now warn if you define an `.onDone` transition on the root node. Root nodes which are "done" represent the machine being in its final state, and can no longer accept any events. This has been reported as confusing in [#1111](https://github.com/davidkpiano/xstate/issues/1111).

## 4.9.1

### Patch Changes

- [`8a97785`](https://github.com/davidkpiano/xstate/commit/8a97785055faaeb1b36040dd4dc04e3b90fa9ec2) [#1137](https://github.com/davidkpiano/xstate/pull/1137) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Added docs for the `choose()` and `pure()` action creators, as well as exporting the `pure()` action creator in the `actions` object.

* [`e65dee9`](https://github.com/davidkpiano/xstate/commit/e65dee928fea60df1e9f83c82fed8102dfed0000) [#1131](https://github.com/davidkpiano/xstate/pull/1131) Thanks [@wKovacs64](https://github.com/wKovacs64)! - Include the new `choose` action in the `actions` export from the `xstate` core package. This was missed in v4.9.0.

## 4.9.0

### Minor Changes

- [`f3ff150`](https://github.com/davidkpiano/xstate/commit/f3ff150f7c50f402704d25cdc053b76836e447e3) [#1103](https://github.com/davidkpiano/xstate/pull/1103) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Simplify the `TransitionConfigArray` and `TransitionConfigMap` types in order to fix excessively deep type instantiation TypeScript reports. This addresses [#1015](https://github.com/davidkpiano/xstate/issues/1015).

* [`6c47b66`](https://github.com/davidkpiano/xstate/commit/6c47b66c3289ff161dc96d9b246873f55c9e18f2) [#1076](https://github.com/davidkpiano/xstate/pull/1076) Thanks [@Andarist](https://github.com/Andarist)! - Added support for conditional actions. It's possible now to have actions executed based on conditions using following:

  ```js
  entry: [
    choose([
      { cond: ctx => ctx > 100, actions: raise('TOGGLE') },
      {
        cond: 'hasMagicBottle',
        actions: [assign(ctx => ({ counter: ctx.counter + 1 }))]
      },
      { actions: ['fallbackAction'] }
    ])
  ];
  ```

  It works very similar to the if-else syntax where only the first matched condition is causing associated actions to be executed and the last ones can be unconditional (serving as a general fallback, just like else branch).

### Patch Changes

- [`1a129f0`](https://github.com/davidkpiano/xstate/commit/1a129f0f35995981c160d756a570df76396bfdbd) [#1073](https://github.com/davidkpiano/xstate/pull/1073) Thanks [@Andarist](https://github.com/Andarist)! - Cleanup internal structures upon receiving termination events from spawned actors.

* [`e88aa18`](https://github.com/davidkpiano/xstate/commit/e88aa18431629e1061b74dfd4a961b910e274e0b) [#1085](https://github.com/davidkpiano/xstate/pull/1085) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an issue with data expressions of root's final nodes being called twice.

- [`88b17b2`](https://github.com/davidkpiano/xstate/commit/88b17b2476ff9a0fbe810df9d00db32c2241cd6e) [#1090](https://github.com/davidkpiano/xstate/pull/1090) Thanks [@rjdestigter](https://github.com/rjdestigter)! - This change carries forward the typestate type information encoded in the arguments of the following functions and assures that the return type also has the same typestate type information:

  - Cloned state machine returned by `.withConfig`.
  - `.state` getter defined for services.
  - `start` method of services.

* [`d5f622f`](https://github.com/davidkpiano/xstate/commit/d5f622f68f4065a2615b5a4a1caae6b508b4840e) [#1069](https://github.com/davidkpiano/xstate/pull/1069) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Loosened event type for `SendAction<TContext, AnyEventObject>`

## 4.8.0

### Minor Changes

- [`55aa589`](https://github.com/davidkpiano/xstate/commit/55aa589648a9afbd153e8b8e74cbf2e0ebf573fb) [#960](https://github.com/davidkpiano/xstate/pull/960) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The machine can now be safely JSON-serialized, using `JSON.stringify(machine)`. The shape of this serialization is defined in `machine.schema.json` and reflected in `machine.definition`.

  Note that `onEntry` and `onExit` have been deprecated in the definition in favor of `entry` and `exit`.

### Patch Changes

- [`1ae31c1`](https://github.com/davidkpiano/xstate/commit/1ae31c17dc81fb63e699b4b9bf1cf4ead023001d) [#1023](https://github.com/davidkpiano/xstate/pull/1023) Thanks [@Andarist](https://github.com/Andarist)! - Fixed memory leak - `State` objects had been retained in closures.

## 4.7.8

### Patch Changes

- [`520580b`](https://github.com/davidkpiano/xstate/commit/520580b4af597f7c83c329757ae972278c2d4494) [#967](https://github.com/davidkpiano/xstate/pull/967) Thanks [@andrewgordstewart](https://github.com/andrewgordstewart)! - Add context & event types to InvokeConfig

## 4.7.7

### Patch Changes

- [`c8db035`](https://github.com/davidkpiano/xstate/commit/c8db035b90a7ab4a557359d493d3dd7973dacbdd) [#936](https://github.com/davidkpiano/xstate/pull/936) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The `escalate()` action can now take in an expression, which will be evaluated against the `context`, `event`, and `meta` to return the error data.

* [`2a3fea1`](https://github.com/davidkpiano/xstate/commit/2a3fea18dcd5be18880ad64007d44947cc327d0d) [#952](https://github.com/davidkpiano/xstate/pull/952) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The typings for the raise() action have been fixed to allow any event to be raised. This typed behavior will be refined in version 5, to limit raised events to those that the machine accepts.

- [`f86d419`](https://github.com/davidkpiano/xstate/commit/f86d41979ed108e2ac4df63299fc16f798da69f7) [#957](https://github.com/davidkpiano/xstate/pull/957) Thanks [@Andarist](https://github.com/Andarist)! - Fixed memory leak - each created service has been registered in internal map but it was never removed from it. Registration has been moved to a point where Interpreter is being started and it's deregistered when it is being stopped.

## 4.7.6

### Patch Changes

- dae8818: Typestates are now propagated to interpreted services.

## 4.7.5

### Patch Changes

- 6b3d767: Fixed issue with delayed transitions scheduling a delayed event for each transition defined for a single delay.

## 4.7.4

### Patch Changes

- 9b043cd: The initial state is now cached inside of the service instance instead of the machine, which was the previous (faulty) strategy. This will prevent entry actions on initial states from being called more than once, which is important for ensuring that actors are not spawned more than once.

## 4.7.3

### Patch Changes

- 2b134eee: Fixed issue with events being forwarded to children after being processed by the current machine. Events are now always forwarded first.
- 2b134eee: Fixed issue with not being able to spawn an actor when processing an event batch.
