# xstate

## 4.14.0

### Minor Changes

- [`119db8fb`](https://github.com/davidkpiano/xstate/commit/119db8fbccd08f899e1275a502d8c4c51b5a130e) [#1577](https://github.com/davidkpiano/xstate/pull/1577) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Expressions can now be used in the `stop()` action creator:

  ```js
  // ...
  actions: stop(context => context.someActor);
  ```

### Patch Changes

- [`8c78e120`](https://github.com/davidkpiano/xstate/commit/8c78e1205a729d933e30db01cd4260d82352a9be) [#1570](https://github.com/davidkpiano/xstate/pull/1570) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The return type of `spawn(machine)` will now be `Actor<State<TContext, TEvent>, TEvent>`, which is a supertype of `Interpreter<...>`.

* [`602687c2`](https://github.com/davidkpiano/xstate/commit/602687c235c56cca552c2d5a9d78adf224f522d8) [#1566](https://github.com/davidkpiano/xstate/pull/1566) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Exit actions will now be properly called when an invoked machine reaches its final state. See [#1109](https://github.com/davidkpiano/xstate/issues/1109) for more details.

- [`6e44d02a`](https://github.com/davidkpiano/xstate/commit/6e44d02ad03af4041046120dd6c975e3b5b3772a) [#1553](https://github.com/davidkpiano/xstate/pull/1553) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The `state.children` property now properly shows all spawned and invoked actors. See [#795](https://github.com/davidkpiano/xstate/issues/795) for more details.

* [`72b0880e`](https://github.com/davidkpiano/xstate/commit/72b0880e6444ae009adca72088872bb5c0760ce3) [#1504](https://github.com/davidkpiano/xstate/pull/1504) Thanks [@Andarist](https://github.com/Andarist)! - Added `status` property on the `Interpreter` - this can be used to differentiate not started, running and stopped interpreters. This property is best compared to values on the new `InterpreterStatus` export.

## 4.13.0

### Minor Changes

- [`f51614df`](https://github.com/davidkpiano/xstate/commit/f51614dff760cfe4511c0bc7cca3d022157c104c) [#1409](https://github.com/davidkpiano/xstate/pull/1409) Thanks [@jirutka](https://github.com/jirutka)! - Fix type `ExtractStateValue` so that it generates a type actually describing a `State.value`

### Patch Changes

- [`b1684ead`](https://github.com/davidkpiano/xstate/commit/b1684eadb1f859db5c733b8d403afc825c294948) [#1402](https://github.com/davidkpiano/xstate/pull/1402) Thanks [@Andarist](https://github.com/Andarist)! - Improved TypeScript type-checking performance a little bit by using distributive conditional type within `TransitionsConfigArray` declarations instead of a mapped type. Kudos to [@amcasey](https://github.com/amcasey), some discussion around this can be found [here](https://github.com/microsoft/TypeScript/issues/39826#issuecomment-675790689)

* [`ad3026d4`](https://github.com/davidkpiano/xstate/commit/ad3026d4309e9a1c719e09fd8c15cdfefce22055) [#1407](https://github.com/davidkpiano/xstate/pull/1407) Thanks [@tomenden](https://github.com/tomenden)! - Fixed an issue with not being able to run XState in Web Workers due to assuming that `window` or `global` object is available in the executing environment, but none of those are actually available in the Web Workers context.

- [`4e949ec8`](https://github.com/davidkpiano/xstate/commit/4e949ec856349062352562c825beb0654e528f81) [#1401](https://github.com/davidkpiano/xstate/pull/1401) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an issue with spawned actors being spawned multiple times when they got spawned in an initial state of a child machine that is invoked in the initial state of a parent machine.

  <details>
  <summary>
  Illustrating example for curious readers.
  </summary>

  ```js
  const child = createMachine({
    initial: 'bar',
    context: {},
    states: {
      bar: {
        entry: assign({
          promise: () => {
            return spawn(() => Promise.resolve('answer'));
          }
        })
      }
    }
  });

  const parent = createMachine({
    initial: 'foo',
    states: {
      foo: {
        invoke: {
          src: child,
          onDone: 'end'
        }
      },
      end: { type: 'final' }
    }
  });

  interpret(parent).start();
  ```

  </details>

## 4.12.0

### Minor Changes

- [`b72e29dd`](https://github.com/davidkpiano/xstate/commit/b72e29dd728b4c1be4bdeaec93909b4e307db5cf) [#1354](https://github.com/davidkpiano/xstate/pull/1354) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The `Action` type was simplified, and as a result, you should see better TypeScript performance.

* [`4dbabfe7`](https://github.com/davidkpiano/xstate/commit/4dbabfe7d5ba154e852b4d460a2434c6fc955726) [#1320](https://github.com/davidkpiano/xstate/pull/1320) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The `invoke.src` property now accepts an object that describes the invoke source with its `type` and other related metadata. This can be read from the `services` option in the `meta.src` argument:

  ```js
  const machine = createMachine(
    {
      initial: 'searching',
      states: {
        searching: {
          invoke: {
            src: {
              type: 'search',
              endpoint: 'example.com'
            }
            // ...
          }
          // ...
        }
      }
    },
    {
      services: {
        search: (context, event, { src }) => {
          console.log(src);
          // => { endpoint: 'example.com' }
        }
      }
    }
  );
  ```

  Specifying a string for `invoke.src` will continue to work the same; e.g., if `src: 'search'` was specified, this would be the same as `src: { type: 'search' }`.

- [`8662e543`](https://github.com/davidkpiano/xstate/commit/8662e543393de7e2f8a6d92ff847043781d10f4d) [#1317](https://github.com/davidkpiano/xstate/pull/1317) Thanks [@Andarist](https://github.com/Andarist)! - All `TTypestate` type parameters default to `{ value: any; context: TContext }` now and the parametrized type is passed correctly between various types which results in more accurate types involving typestates.

### Patch Changes

- [`3ab3f25e`](https://github.com/davidkpiano/xstate/commit/3ab3f25ea297e4d770eef512e9583475c943845d) [#1285](https://github.com/davidkpiano/xstate/pull/1285) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an issue with initial state of invoked machines being read without custom data passed to them which could lead to a crash when evaluating transient transitions for the initial state.

* [`a7da1451`](https://github.com/davidkpiano/xstate/commit/a7da14510fd1645ad041836b567771edb5b90827) [#1290](https://github.com/davidkpiano/xstate/pull/1290) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The "Attempted to spawn an Actor [...] outside of a service. This will have no effect." warnings are now silenced for "lazily spawned" actors, which are actors that aren't immediately active until the function that creates them are called:

  ```js
  // ⚠️ "active" actor - will warn
  spawn(somePromise);

  // 🕐 "lazy" actor - won't warn
  spawn(() => somePromise);

  // 🕐 machines are also "lazy" - won't warn
  spawn(someMachine);
  ```

  It is recommended that all `spawn(...)`-ed actors are lazy, to avoid accidentally initializing them e.g., when reading `machine.initialState` or calculating otherwise pure transitions. In V5, this will be enforced.

- [`c1f3d260`](https://github.com/davidkpiano/xstate/commit/c1f3d26069ee70343f8045a48411e02a68f98cbd) [#1317](https://github.com/davidkpiano/xstate/pull/1317) Thanks [@Andarist](https://github.com/Andarist)! - Fixed a type returned by a `raise` action - it's now `RaiseAction<TEvent> | SendAction<TContext, AnyEventObject, TEvent>` instead of `RaiseAction<TEvent> | SendAction<TContext, TEvent, TEvent>`. This makes it comaptible in a broader range of scenarios.

* [`8270d5a7`](https://github.com/davidkpiano/xstate/commit/8270d5a76c71add3a5109e069bd85716b230b5d4) [#1372](https://github.com/davidkpiano/xstate/pull/1372) Thanks [@christianchown](https://github.com/christianchown)! - Narrowed the `ServiceConfig` type definition to use a specific event type to prevent compilation errors on strictly-typed `MachineOptions`.

- [`01e3e2dc`](https://github.com/davidkpiano/xstate/commit/01e3e2dcead63dce3eef5ab745395584efbf05fa) [#1320](https://github.com/davidkpiano/xstate/pull/1320) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The JSON definition for `stateNode.invoke` objects will no longer include the `onDone` and `onError` transitions, since those transitions are already merged into the `transitions` array. This solves the issue of reviving a serialized machine from JSON, where before, the `onDone` and `onError` transitions for invocations were wrongly duplicated.

## 4.11.0

### Minor Changes

- [`36ed8d0a`](https://github.com/davidkpiano/xstate/commit/36ed8d0a3adf5b7fd187b0abe198220398e8b056) [#1262](https://github.com/davidkpiano/xstate/pull/1262) Thanks [@Andarist](https://github.com/Andarist)! - Improved type inference for `InvokeConfig['data']`. This has required renaming `data` property on `StateNode` instances to `doneData`. This property was never meant to be a part of the public API, so we don't consider this to be a breaking change.

* [`2c75ab82`](https://github.com/davidkpiano/xstate/commit/2c75ab822e49cb1a23c1e14eb7bd04548ab143eb) [#1219](https://github.com/davidkpiano/xstate/pull/1219) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The resolved value of the `invoke.data` property is now available in the "invoke meta" object, which is passed as the 3rd argument to the service creator in `options.services`. This will work for all types of invoked services now, including promises, observables, and callbacks.

  ```js
  const machine = createMachine({
    initial: 'pending',
    context: {
      id: 42
    },
    states: {
      pending: {
        invoke: {
          src: 'fetchUser',
          data: {
            userId: (context) => context.id
          },
          onDone: 'success'
        }
      },
      success: {
        type: 'final'
      }
    }
  },
  {
    services: {
      fetchUser: (ctx, _, { data }) => {
        return fetch(`some/api/user/${data.userId}`)
          .then(response => response.json());
      }
    }
  }
  ```

- [`a6c78ae9`](https://github.com/davidkpiano/xstate/commit/a6c78ae960acba36b61a41a5d154ea59908010b0) [#1249](https://github.com/davidkpiano/xstate/pull/1249) Thanks [@davidkpiano](https://github.com/davidkpiano)! - New property introduced for eventless (transient) transitions: **`always`**, which indicates a transition that is always taken when in that state. Empty string transition configs for [transient transitions](https://xstate.js.org/docs/guides/transitions.html#transient-transitions) are deprecated in favor of `always`:

  ```diff
  // ...
  states: {
    playing: {
  +   always: [
  +     { target: 'win', cond: 'didPlayerWin' },
  +     { target: 'lose', cond: 'didPlayerLose' },
  +   ],
      on: {
        // ⚠️ Deprecation warning
  -     '': [
  -       { target: 'win', cond: 'didPlayerWin' },
  -       { target: 'lose', cond: 'didPlayerLose' },
  -     ]
      }
    }
  }
  // ...
  ```

  The old empty string syntax (`'': ...`) will continue to work until V5.

### Patch Changes

- [`36ed8d0a`](https://github.com/davidkpiano/xstate/commit/36ed8d0a3adf5b7fd187b0abe198220398e8b056) [#1262](https://github.com/davidkpiano/xstate/pull/1262) Thanks [@Andarist](https://github.com/Andarist)! - `StateMachine<any, any, any>` is no longer a part of the `InvokeConfig` type, but rather it creates a union with `InvokeConfig` in places where it is needed. This change shouldn't affect consumers' code.

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
