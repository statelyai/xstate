# xstate

## 4.32.1

### Patch Changes

- [#3292](https://github.com/statelyai/xstate/pull/3292) [`16514e466`](https://github.com/statelyai/xstate/commit/16514e4663deba95731a84deaee94c17edec1e06) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an issue in the `EmittedFrom` type helper that could prevent it from inferring the desired type from some services.

## 4.32.0

### Minor Changes

- [#3234](https://github.com/statelyai/xstate/pull/3234) [`ce376b388`](https://github.com/statelyai/xstate/commit/ce376b3889ea900e67d20026517b87185377c32e) Thanks [@Andarist](https://github.com/Andarist)! - Added a `StateValueFrom` helper that can be used to extract valid state values from a machine. This might specifically be useful with typegen because typegenless `state.matches` accepts `any` anyway.

### Patch Changes

- [#3215](https://github.com/statelyai/xstate/pull/3215) [`44c66e74f`](https://github.com/statelyai/xstate/commit/44c66e74f9eafbb326979234e2bbe51e38dc3a86) Thanks [@tom-sherman](https://github.com/tom-sherman)! - Removing the timeout that's built in to `waitFor` is now supported by explicitly passing an `Infinity` value.

  Example usage:

  ```js
  import { waitFor } from 'xstate/lib/waitFor';

  // This will
  const loggedInState = await waitFor(
    loginService,
    state => state.hasTag('loggedIn'),
    { timeout: Infinity }
  );
  ```

  This fixes a bug that causes `waitFor` to reject with an error immediately due to the behaviour of `setTimeout`.

* [#3230](https://github.com/statelyai/xstate/pull/3230) [`780458c92`](https://github.com/statelyai/xstate/commit/780458c921d4525c7a00119c7eb43d4833978861) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an issue with typegen types not being able to provide events that had a union of strings as their `type` (such as `{ type: 'INC' | 'DEC'; value: number; }`).

- [#3252](https://github.com/statelyai/xstate/pull/3252) [`a94dfd467`](https://github.com/statelyai/xstate/commit/a94dfd46772cacc59154c165f27122164f48625b) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an issue with `EventFrom` not being able to extract events that had a union of strings as their `type` (such as `{ type: 'INC' | 'DEC'; value: number; }`).

* [#3090](https://github.com/statelyai/xstate/pull/3090) [`c4f73ca13`](https://github.com/statelyai/xstate/commit/c4f73ca1356d106423c8b4ee34865f7e4f2d2bb6) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an issue with action objects not receiving correct event types when used in the second argument to the `createMachine`.

- [#3238](https://github.com/statelyai/xstate/pull/3238) [`3df6335ef`](https://github.com/statelyai/xstate/commit/3df6335ef8db4edcf0a47d4c559716552ce4bbe8) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The typings for `sendTo(...)` have been fixed.

* [#3228](https://github.com/statelyai/xstate/pull/3228) [`fe5f0e6c9`](https://github.com/statelyai/xstate/commit/fe5f0e6c9bbb6ff740673889892301c8989eacfd) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an issue with inline functions in the config object used as transition actions not having their argument types inferred.

- [#3252](https://github.com/statelyai/xstate/pull/3252) [`a94dfd467`](https://github.com/statelyai/xstate/commit/a94dfd46772cacc59154c165f27122164f48625b) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an issue with default `TEvent` (`{ type: string }`) not being correctly provided to inline transition actions.

## 4.31.0

### Minor Changes

- [#3190](https://github.com/statelyai/xstate/pull/3190) [`fbf5ca0ad`](https://github.com/statelyai/xstate/commit/fbf5ca0adcafacbf170f5522eec64ac612bdeb47) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The `waitFor(...)` helper function, which asynchronously _waits_ for an actor's emitted value to satisfy a `predicate` before a `timeout`, is now available.

  Example usage:

  ```js
  import { waitFor } from 'xstate/lib/waitFor';

  // ...
  const loginService = interpret(loginMachine).start();

  const loggedInState = await waitFor(loginService, state =>
    state.hasTag('loggedIn')
  );

  loggedInState.hasTag('loggedIn'); // true
  ```

* [#3200](https://github.com/statelyai/xstate/pull/3200) [`56c0a36`](https://github.com/statelyai/xstate/commit/56c0a36f222195d0b18edd7a72d5429a213b3808) Thanks [@Andarist](https://github.com/Andarist)! - Subscribing to a stopped interpreter will now always immediately emit its state and call a completion callback.

### Patch Changes

- [#3166](https://github.com/statelyai/xstate/pull/3166) [`be4c5c74d`](https://github.com/statelyai/xstate/commit/be4c5c74d400a1ca58befd306029c3ce77793e3e) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an issue with `state.tags` not having correct values when resolving micro transitions (taken in response to raised events). This was creating issues when checking tags in guards.

* [#3171](https://github.com/statelyai/xstate/pull/3171) [`14f8b4785`](https://github.com/statelyai/xstate/commit/14f8b4785599fb366ae2901c03c2a3202594499c) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an issue with `onDone` on parallel states not being "called" correctly when a parallel state had a history state defined directly on it.

- [#2939](https://github.com/statelyai/xstate/pull/2939) [`360e85462`](https://github.com/statelyai/xstate/commit/360e8546298c4a06b6d51d8f12c0563672dd7acf) Thanks [@Andarist](https://github.com/Andarist)! - Fixed issues with not disposing some cached internal values when stopping interpreters, which could have led to issues when starting such an interpreter again.

* [#3153](https://github.com/statelyai/xstate/pull/3153) [`b36ef9dda`](https://github.com/statelyai/xstate/commit/b36ef9dda560fca4c00428f48742fd9d2e325324) Thanks [@Andarist](https://github.com/Andarist)! - Made type displays (like in the IDE tooltips etc) more readable by using a type interface for the internal `ResolveTypegenMeta` type.

## 4.30.6

### Patch Changes

- [#3131](https://github.com/statelyai/xstate/pull/3131) [`d9a0bcfc9`](https://github.com/statelyai/xstate/commit/d9a0bcfc9be03e49726d6dc4a6bbce25239913a1) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an issue with event type being inferred from too many places within `createMachine` call and possibly ending up as `any`/`AnyEventObject` for the entire machine.

* [#3133](https://github.com/statelyai/xstate/pull/3133) [`4feef9d47`](https://github.com/statelyai/xstate/commit/4feef9d47f81d1b28f2f898431eb4bd1c42d8368) Thanks [@fw6](https://github.com/fw6)! - Fixed compatibility with esoteric [Mini Program](https://developers.weixin.qq.com/miniprogram/en/dev/framework/app-service/) environment where `global` object was available but `global.console` wasn't.

- [#3140](https://github.com/statelyai/xstate/pull/3140) [`502ffe91a`](https://github.com/statelyai/xstate/commit/502ffe91a19579f5f747b76ce29d50de81e8b15c) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an issue with interpreters started using a persisted state not being "resolved" in full. This could cause some things, such as `after` transitions, not being executed correctly after starting an interpreter like this.

* [#3147](https://github.com/statelyai/xstate/pull/3147) [`155539c85`](https://github.com/statelyai/xstate/commit/155539c8597b2f2783e8419c782922545d7e6424) Thanks [@Andarist](https://github.com/Andarist)! - Fixed a TS inference issue causing some functions to infer the constraint type for the event type even though a `StateMachine` passed to the function was parametrized with a concrete type for the event. More information can be found [here](https://github.com/statelyai/xstate/issues/3141#issuecomment-1063995705).

- [#3146](https://github.com/statelyai/xstate/pull/3146) [`4cf89b5f9`](https://github.com/statelyai/xstate/commit/4cf89b5f9cf645f741164d23e3bc35dd7c5706f6) Thanks [@Andarist](https://github.com/Andarist)! - Fixed compatibility of `Interpreter` with older versions of TypeScript. This ensures that our interpreters can correctly be consumed by functions expecting `ActorRef` interface (like for example `useSelector`).

* [#3139](https://github.com/statelyai/xstate/pull/3139) [`7b45fda9e`](https://github.com/statelyai/xstate/commit/7b45fda9e1bd544b505c86ddcd6cf1f949007fef) Thanks [@Andarist](https://github.com/Andarist)! - `InterpreterFrom` and `ActorRefFrom` types used on machines with typegen data should now correctly return types with final/resolved typegen data. The "final" type here means a type that already encodes the information that all required implementations have been provided. Before this change this wouldn't typecheck correctly:

  ```ts
  const machine = createMachine({
    // this encodes that we still expect `myAction` to be provided
    tsTypes: {} as Typegen0
  });
  const service: InterpreterFrom<typeof machine> = machine.withConfig({
    actions: {
      myAction: () => {}
    }
  });
  ```

- [#3097](https://github.com/statelyai/xstate/pull/3097) [`c881c8ca9`](https://github.com/statelyai/xstate/commit/c881c8ca9baaf4928064a04d7034cd775a702bc2) Thanks [@davidkpiano](https://github.com/davidkpiano)! - State that is persisted and restored from `machine.resolveState(state)` will now have the correct `state.machine` value, so that `state.can(...)` and other methods will work as expected. See [#3096](https://github.com/statelyai/xstate/issues/3096) for more details.

## 4.30.5

### Patch Changes

- [#3118](https://github.com/statelyai/xstate/pull/3118) [`28e353081`](https://github.com/statelyai/xstate/commit/28e3530818e1d800eba7b6d821bde0c0048f0579) Thanks [@Andarist](https://github.com/Andarist)! - Fixed a bundling issue that prevented the `keys()` export to be preserved in the previous release.

## 4.30.4

### Patch Changes

- [#3104](https://github.com/statelyai/xstate/pull/3104) [`3706c62f4`](https://github.com/statelyai/xstate/commit/3706c62f49daa5cf84172713a004eb26704342f5) Thanks [@Andarist](https://github.com/Andarist)! - Fixed `ContextFrom` helper type to work on typegened machines.

* [#3113](https://github.com/statelyai/xstate/pull/3113) [`144131bed`](https://github.com/statelyai/xstate/commit/144131beda5c00a15fbe0f58a3309eac81d940eb) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The `keys()` utility function export, which was removed in [#3089](https://github.com/statelyai/xstate/issues/3089), is now added back, as older versions of XState libraries may depend on it still. See [#3106](https://github.com/statelyai/xstate/issues/3106) for more details.

- [#3104](https://github.com/statelyai/xstate/pull/3104) [`3706c62f4`](https://github.com/statelyai/xstate/commit/3706c62f49daa5cf84172713a004eb26704342f5) Thanks [@Andarist](https://github.com/Andarist)! - Fixed `EventFrom` helper type to work on machines.

## 4.30.3

### Patch Changes

- [#3088](https://github.com/statelyai/xstate/pull/3088) [`9f02271a3`](https://github.com/statelyai/xstate/commit/9f02271a3dd0b314a270f54d4de56af8daab31d1) Thanks [@Andarist](https://github.com/Andarist)! - Added some internal `@ts-ignore` comments to fix consuming projects that do not use `skipLibCheck`.

* [#3082](https://github.com/statelyai/xstate/pull/3082) [`8d3f2cfea`](https://github.com/statelyai/xstate/commit/8d3f2cfea7b57b6293fd862844400353e2a7451a) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an issue with context type being inferred from too many places within `createMachine` call and possibly ending up as `any` for the entire machine.

- [#3027](https://github.com/statelyai/xstate/pull/3027) [`97ad964bd`](https://github.com/statelyai/xstate/commit/97ad964bd064ce48c28323052557336ed4def1a9) Thanks [@hedgepigdaniel](https://github.com/hedgepigdaniel)! - Fixed an issue with not being able to call `createMachine` in a generic context when the type for the context was generic and not concrete.

* [#3084](https://github.com/statelyai/xstate/pull/3084) [`50c271dc1`](https://github.com/statelyai/xstate/commit/50c271dc1a1a05b035364f8247aa4d80d613864f) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an issue with context type defined using `schema.context` being sometimes widened based on `config.context`. If both are given the `schema.context` should always take precedence and should represent the complete type of the context.

- [#3089](https://github.com/statelyai/xstate/pull/3089) [`862697e29`](https://github.com/statelyai/xstate/commit/862697e2990934d46050580d7e09c749d09d8426) Thanks [@Andarist](https://github.com/Andarist)! - Fixed compatibility with Skypack by exporting some shared utilities from root entry of XState and consuming them directly in other packages (this avoids accessing those things using deep imports and thus it avoids creating those compatibility problems).

* [#3087](https://github.com/statelyai/xstate/pull/3087) [`ae9579497`](https://github.com/statelyai/xstate/commit/ae95794971f765e3f984f4080f8a92236c53cd6c) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an issue with `ActorRefFrom` not resolving the typegen metadata from machine types given to it. This could sometimes result in types assignability problems, especially when using machine factories and `spawn`.

## 4.30.2

### Patch Changes

- [#3063](https://github.com/statelyai/xstate/pull/3063) [`c826559b4`](https://github.com/statelyai/xstate/commit/c826559b4c495f64c85dd79f1d1262ae9e7d15bf) Thanks [@Andarist](https://github.com/Andarist)! - Fixed a type compatibility with Svelte's readables. It should be possible again to use XState interpreters directly as readables at the type-level.

* [#3051](https://github.com/statelyai/xstate/pull/3051) [`04091f29c`](https://github.com/statelyai/xstate/commit/04091f29cb80dd8e6c95e42668bd56f02f775973) Thanks [@Andarist](https://github.com/Andarist)! - Fixed type compatibility with functions accepting machines that were created before typegen was a thing in XState. This should make it possible to use the latest version of XState with `@xstate/vue`, `@xstate/react@^1` and some community packages.

  Note that this change doesn't make those functions to accept machines that have typegen information on them. For that the signatures of those functions would have to be adjusted.

- [#3077](https://github.com/statelyai/xstate/pull/3077) [`2c76ecac5`](https://github.com/statelyai/xstate/commit/2c76ecac5de73fbb3a2376a0f66802480ec9549f) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an issue with nested `state.matches` calls when the typegen was involved. The `state` ended up being `never` and thus not usable.

## 4.30.1

### Patch Changes

- [#3040](https://github.com/statelyai/xstate/pull/3040) [`18dc2b3e2`](https://github.com/statelyai/xstate/commit/18dc2b3e2c49527b2155063490bb7295f1f06043) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The `AnyState` and `AnyStateMachine` types are now available, which can be used to express any state and state machine, respectively:

  ```ts
  import type { AnyState, AnyStateMachine } from 'xstate';

  // A function that takes in any state machine
  function visualizeMachine(machine: AnyStateMachine) {
    // (exercise left to reader)
  }

  function logState(state: AnyState) {
    // ...
  }
  ```

* [#3042](https://github.com/statelyai/xstate/pull/3042) [`e53396f08`](https://github.com/statelyai/xstate/commit/e53396f083091db26c117000ce6ec070914360e9) Thanks [@suerta-git](https://github.com/suerta-git)! - Added the `AnyStateConfig` type, which represents any `StateConfig<...>`:

  ```ts
  import type { AnyStateConfig } from 'xstate';
  import { State } from 'xstate';

  // Retrieving the state config from localStorage
  const stateConfig: AnyStateConfig = JSON.parse(
    localStorage.getItem('app-state')
  );

  // Use State.create() to restore state from config object with correct type
  const previousState = State.create(stateConfig);
  ```

## 4.30.0

### Minor Changes

- [#2965](https://github.com/statelyai/xstate/pull/2965) [`8b8f719c3`](https://github.com/statelyai/xstate/commit/8b8f719c36ab2c09fcd11b529cc6c9c89a06ad2e) Thanks [@satyasinha](https://github.com/satyasinha)! - All actions are now available in the `actions` variable when importing: `import { actions } from 'xstate'`

* [#2892](https://github.com/statelyai/xstate/pull/2892) [`02de3d44f`](https://github.com/statelyai/xstate/commit/02de3d44f8ca87b4dcb4153d3560da7d43ee9d0b) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Persisted state can now be easily restored to a state compatible with the machine without converting it to a `State` instance first:

  ```js
  // Persisting a state
  someService.subscribe(state => {
    localStorage.setItem('some-state', JSON.stringify(state));
  });

  // Restoring a state
  const stateJson = localStorage.getItem('some-state');

  // No need to convert `stateJson` object to a state!
  const someService = interpret(someMachine).start(stateJson);
  ```

### Patch Changes

- [#3012](https://github.com/statelyai/xstate/pull/3012) [`ab431dcb8`](https://github.com/statelyai/xstate/commit/ab431dcb8bd67a3f0bcfc9b6ca31779bb15d14af) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an issue with a reference to `@types/node` being inserted into XState's compiled output. This could cause unexpected issues in projects expecting APIs like `setTimeout` to be typed with browser compatibility in mind.

* [#3023](https://github.com/statelyai/xstate/pull/3023) [`642e9f5b8`](https://github.com/statelyai/xstate/commit/642e9f5b83dae79f016be8b657d25499077bbcda) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an issue with states created using `machine.getInitialState` not being "resolved" in full. This could cause some things, such as `after` transitions, not being executed correctly after starting an interpreter using such state.

- [#2982](https://github.com/statelyai/xstate/pull/2982) [`a39145580`](https://github.com/statelyai/xstate/commit/a391455803171dcf03a1a0ec589f9dd603260d63) Thanks [@Andarist](https://github.com/Andarist)! - Marked all phantom properties on the `StateMachine` type as deprecated. This deprioritized them in IDEs so they don't popup as first suggestions during property access.

* [#2992](https://github.com/statelyai/xstate/pull/2992) [`22737adf2`](https://github.com/statelyai/xstate/commit/22737adf211971197f3809f406ac3bee54dc69f0) Thanks [@Andarist](https://github.com/Andarist), [@mattpocock](https://github.com/mattpocock)! - Fixed an issue with `state.context` becoming `any` after `state.matches` when typegen is used.

- [#2981](https://github.com/statelyai/xstate/pull/2981) [`edf60d67b`](https://github.com/statelyai/xstate/commit/edf60d67b3ca58eca96c7853410528c4e4abac7b) Thanks [@Andarist](https://github.com/Andarist)! - Moved an internal `@ts-ignore` to a JSDoc-style comment to fix consuming projects that do not use `skipLibCheck`. Regular inline and block comments are not preserved in the TypeScript's emit.

## 4.29.0

### Minor Changes

- [#2674](https://github.com/statelyai/xstate/pull/2674) [`1cd26811c`](https://github.com/statelyai/xstate/commit/1cd26811cea441366a082b0f77c7a6ffb135dc38) Thanks [@Andarist](https://github.com/Andarist)! - Using `config.schema` becomes the preferred way of "declaring" TypeScript generics with this release:

  ```js
  createMachine({
      schema: {
          context: {} as { count: number },
          events: {} as { type: 'INC' } | { type: 'DEC' }
      }
  })
  ```

  This allows us to leverage the inference algorithm better and unlocks some exciting possibilities for using XState in a more type-strict manner.

* [#2674](https://github.com/statelyai/xstate/pull/2674) [`1cd26811c`](https://github.com/statelyai/xstate/commit/1cd26811cea441366a082b0f77c7a6ffb135dc38) Thanks [@Andarist](https://github.com/Andarist), [@mattpocock](https://github.com/mattpocock)! - Added the ability to tighten TS declarations of machine with generated metadata. This opens several exciting doors to being able to use typegen seamlessly with XState to provide an amazing typing experience.

  With the [VS Code extension](https://marketplace.visualstudio.com/items?itemName=statelyai.stately-vscode), you can specify a new attribute called `tsTypes: {}` in your machine definition:

  ```ts
  const machine = createMachine({
    tsTypes: {}
  });
  ```

  The extension will automatically add a type assertion to this property, which allows for type-safe access to a lot of XState's API's.

  ⚠️ This feature is in beta. Actions/services/guards/delays might currently get incorrectly annotated if they are called "in response" to always transitions or raised events. We are working on fixing this, both in XState and in the typegen.

### Patch Changes

- [#2962](https://github.com/statelyai/xstate/pull/2962) [`32520650b`](https://github.com/statelyai/xstate/commit/32520650b7d6b43e416b896054033432aaede5d5) Thanks [@mattpocock](https://github.com/mattpocock)! - Added `t()`, which can be used to provide types for `schema` attributes in machine configs:

  ```ts
  import { t, createMachine } from 'xstate';

  const machine = createMachine({
    schema: {
      context: t<{ value: number }>(),
      events: t<{ type: 'EVENT_1' } | { type: 'EVENT_2' }>()
    }
  });
  ```

* [#2957](https://github.com/statelyai/xstate/pull/2957) [`8550ddda7`](https://github.com/statelyai/xstate/commit/8550ddda73e2ad291e19173d7fa8d13e3336fbb9) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The repository links have been updated from `github.com/davidkpiano` to `github.com/statelyai`.

## 4.28.1

### Patch Changes

- [#2943](https://github.com/statelyai/xstate/pull/2943) [`e9f3f07a1`](https://github.com/statelyai/xstate/commit/e9f3f07a1ee9fe97af7e8f532c5b3dd3c4f73cec) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an infinite loop when initially spawned actor (in an initial context) responded synchronously to its parent.

* [#2953](https://github.com/statelyai/xstate/pull/2953) [`90fa97008`](https://github.com/statelyai/xstate/commit/90fa97008970283f17a3f2f6aa9b1b7071593e80) Thanks [@Andarist](https://github.com/Andarist)! - Bring back the global type declaration for the `Symbol.observable` to fix consuming projects that do not use `skipLibCheck`.

- [#2903](https://github.com/statelyai/xstate/pull/2903) [`b6dde9075`](https://github.com/statelyai/xstate/commit/b6dde9075adb3bb3522b4b8f8eeb804d3221a527) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an issue with exit actions being called in random order when stopping a machine. They should always be called in the reversed document order (the ones defined on children should be called before the ones defined on ancestors and the ones defined on states appearing later in the code should be called before the ones defined on their sibling states).

## 4.28.0

### Minor Changes

- [#2835](https://github.com/statelyai/xstate/pull/2835) [`029f7b75a`](https://github.com/statelyai/xstate/commit/029f7b75a22a8186e5e3983dfd980c52369ef09f) Thanks [@woutermont](https://github.com/woutermont)! - Added interop observable symbols to `ActorRef` so that actor refs are compatible with libraries like RxJS.

### Patch Changes

- [#2864](https://github.com/statelyai/xstate/pull/2864) [`4252ee212`](https://github.com/statelyai/xstate/commit/4252ee212e59fd074707b933c101662d47938849) Thanks [@davidkpiano](https://github.com/statelyai)! - Generated IDs for invocations that do not provide an `id` are now based on the state ID to avoid collisions:

  ```js
  createMachine({
    id: 'test',
    initial: 'p',
    states: {
      p: {
        type: 'parallel',
        states: {
          // Before this change, both invoke IDs would be 'someSource',
          // which is incorrect.
          a: {
            invoke: {
              src: 'someSource'
              // generated invoke ID: 'test.p.a:invocation[0]'
            }
          },
          b: {
            invoke: {
              src: 'someSource'
              // generated invoke ID: 'test.p.b:invocation[0]'
            }
          }
        }
      }
    }
  });
  ```

* [#2925](https://github.com/statelyai/xstate/pull/2925) [`239b4666a`](https://github.com/statelyai/xstate/commit/239b4666ac302d80c028fef47c6e8ab7e0ae2757) Thanks [@devanfarrell](https://github.com/devanfarrell)! - The `sendTo(actorRef, event)` action creator introduced in `4.27.0`, which was not accessible from the package exports, can now be used just like other actions:

  ```js
  import { actions } from 'xstate';

  const { sendTo } = actions;
  ```

## 4.27.0

### Minor Changes

- [#2800](https://github.com/statelyai/xstate/pull/2800) [`759a90155`](https://github.com/statelyai/xstate/commit/759a9015512bbf532d7044afe6a889c04dc7edf6) Thanks [@davidkpiano](https://github.com/statelyai)! - The `sendTo(actorRef, event)` action creator has been introduced. It allows you to specify the recipient actor ref of an event first, so that the event can be strongly typed against the events allowed to be received by the actor ref:

  ```ts
  // ...
  entry: sendTo(
    (ctx) => ctx.someActorRef,
    { type: 'EVENT_FOR_ACTOR' }
  ),
  // ...
  ```

### Patch Changes

- [#2804](https://github.com/statelyai/xstate/pull/2804) [`f3caecf5a`](https://github.com/statelyai/xstate/commit/f3caecf5ad384cfe2a843c26333aaa46a77ece68) Thanks [@davidkpiano](https://github.com/statelyai)! - The `state.can(...)` method no longer unnecessarily executes `assign()` actions and instead determines if a given event will change the state by reading transition data before evaluating actions.

* [#2856](https://github.com/statelyai/xstate/pull/2856) [`49c2e9094`](https://github.com/statelyai/xstate/commit/49c2e90945d369e2dfb2e4fc376b3f46714dce09) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an issue with stopped children sometimes starting their own child actors. This could happen when the child was stopped synchronously (for example by its parent) when transitioning to an invoking state.

- [#2895](https://github.com/statelyai/xstate/pull/2895) [`df5ffce14`](https://github.com/statelyai/xstate/commit/df5ffce14908d0aa8056a56001039dfd260be1a4) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an issue with some exit handlers being executed more than once when stopping a machine.

## 4.26.1

### Patch Changes

- [#2819](https://github.com/statelyai/xstate/pull/2819) [`0d51d33cd`](https://github.com/statelyai/xstate/commit/0d51d33cd6dc6ab876a5554788300282d03fa5d1) Thanks [@simonihmig](https://github.com/simonihmig)! - Support `globalThis` in `getGlobal()` for better compatibility

* [#2828](https://github.com/statelyai/xstate/pull/2828) [`c0ef3e8`](https://github.com/statelyai/xstate/commit/c0ef3e882c688e6beefb196a3293ec71b65625e3) Thanks [@davidkpiano](https://github.com/statelyai)! - XState is now compatible with TypeScript version 4.5.

## 4.26.0

### Minor Changes

- [#2672](https://github.com/statelyai/xstate/pull/2672) [`8e1d05d`](https://github.com/statelyai/xstate/commit/8e1d05dcafab0d1c8a63b07694b3f208850b0b4b) Thanks [@davidkpiano](https://github.com/statelyai)! - The `description` property is a new top-level property for state nodes and transitions, that lets you provide text descriptions:

  ```ts
  const machine = createMachine({
    // ...
    states: {
      active: {
        // ...
        description: 'The task is in progress',
        on: {
          DEACTIVATE: {
            // ...
            description: 'Deactivates the task'
          }
        }
      }
    }
  });
  ```

  Future Stately tooling will use the `description` to render automatically generated documentation, type hints, and enhancements to visual tools.

* [#2743](https://github.com/statelyai/xstate/pull/2743) [`e268bf34a`](https://github.com/statelyai/xstate/commit/e268bf34a0dfe442ef7b43ecf8ab5c8d81ac69fb) Thanks [@janovekj](https://github.com/janovekj)! - Add optional type parameter to narrow type returned by `EventFrom`. You can use it like this:

  ```ts
  type UpdateNameEvent = EventFrom<typeof userModel>;
  ```

### Patch Changes

- [#2738](https://github.com/statelyai/xstate/pull/2738) [`942fd90e0`](https://github.com/statelyai/xstate/commit/942fd90e0c7a942564dd9c2ffebb93d6c86698df) Thanks [@michelsciortino](https://github.com/michelsciortino)! - The `tags` property was missing from state's definitions. This is used when converting a state to a JSON string. Since this is how we serialize states within [`@xstate/inspect`](https://github.com/statelyai/xstate/tree/main/packages/xstate-inspect) this has caused inspected machines to miss the `tags` information.

* [#2740](https://github.com/statelyai/xstate/pull/2740) [`707cb981f`](https://github.com/statelyai/xstate/commit/707cb981fdb8a5c75cacb7e9bfa5c7e5a1cc1c88) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an issue with tags being missed on a service state after starting that service using a state value, like this:

  ```js
  const service = interpret(machine).start('active');
  service.state.hasTag('foo'); // this should now return a correct result
  ```

- [#2691](https://github.com/statelyai/xstate/pull/2691) [`a72806035`](https://github.com/statelyai/xstate/commit/a728060353c9cb9bdb0cd37aacf793498a8750c8) Thanks [@davidkpiano](https://github.com/statelyai)! - Meta data can now be specified for `invoke` configs in the `invoke.meta` property:

  ```js
  const machine = createMachine({
    // ...
    invoke: {
      src: (ctx, e) => findUser(ctx.userId),
      meta: {
        summary: 'Finds user',
        updatedAt: '2021-09-...',
        version: '4.12.2'
        // other descriptive meta properties
      }
    }
  });
  ```

## 4.25.0

### Minor Changes

- [#2657](https://github.com/statelyai/xstate/pull/2657) [`72155c1b7`](https://github.com/statelyai/xstate/commit/72155c1b7887b94f2d8f7cb73a1af17a591cc74c) Thanks [@mattpocock](https://github.com/mattpocock)! - Removed the ability to pass a model as a generic to `createMachine`, in favour of `model.createMachine`. This lets us cut an overload from the definition of `createMachine`, meaning errors become more targeted and less cryptic.

  This means that this approach is no longer supported:

  ```ts
  const model = createModel({});

  const machine = createMachine<typeof model>();
  ```

  If you're using this approach, you should use `model.createMachine` instead:

  ```ts
  const model = createModel({});

  const machine = model.createMachine();
  ```

### Patch Changes

- [#2659](https://github.com/statelyai/xstate/pull/2659) [`7bfeb930d`](https://github.com/statelyai/xstate/commit/7bfeb930d65eb4443c300a2d28aeef3664fcafea) Thanks [@Andarist](https://github.com/Andarist)! - Fixed a regression in the inline actions type inference in models without explicit action creators.

  ```js
  const model = createModel(
    { foo: 100 },
    {
      events: {
        BAR: () => ({})
      }
    }
  );

  model.createMachine({
    // `ctx` was of type `any`
    entry: ctx => {},
    exit: assign({
      // `ctx` was of type `unknown`
      foo: ctx => 42
    })
  });
  ```

## 4.24.1

### Patch Changes

- [#2649](https://github.com/statelyai/xstate/pull/2649) [`ad611007a`](https://github.com/statelyai/xstate/commit/ad611007a9111e8aefe9d22049ac99072588db9f) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an issue with functions used as inline actions not always receiving the correct arguments when used with `preserveActionOrder`.

## 4.24.0

### Minor Changes

- [#2546](https://github.com/statelyai/xstate/pull/2546) [`a4cfce18c`](https://github.com/statelyai/xstate/commit/a4cfce18c0c179faef15adf25a75b08903064e28) Thanks [@davidkpiano](https://github.com/statelyai)! - You can now know if an event will cause a state change by using the new `state.can(event)` method, which will return `true` if an interpreted machine will "change" the state when sent the `event`, or `false` otherwise:

  ```js
  const machine = createMachine({
    initial: 'inactive',
    states: {
      inactive: {
        on: {
          TOGGLE: 'active'
        }
      },
      active: {
        on: {
          DO_SOMETHING: { actions: ['something'] }
        }
      }
    }
  });

  const state = machine.initialState;

  state.can('TOGGLE'); // true
  state.can('DO_SOMETHING'); // false

  // Also takes in full event objects:
  state.can({
    type: 'DO_SOMETHING',
    data: 42
  }); // false
  ```

  A state is considered "changed" if any of the following are true:

  - its `state.value` changes
  - there are new `state.actions` to be executed
  - its `state.context` changes

  See [`state.changed` (documentation)](https://xstate.js.org/docs/guides/states.html#state-changed) for more details.

### Patch Changes

- [#2632](https://github.com/statelyai/xstate/pull/2632) [`f8cf5dfe0`](https://github.com/statelyai/xstate/commit/f8cf5dfe0bf20c8545208ed7b1ade619933004f9) Thanks [@davidkpiano](https://github.com/statelyai)! - A regression was fixed where actions were being typed as `never` if events were specified in `createModel(...)` but not actions:

  ```ts
  const model = createModel(
    {},
    {
      events: {}
    }
  );

  model.createMachine({
    // These actions will cause TS to not compile
    entry: 'someAction',
    exit: { type: 'someObjectAction' }
  });
  ```

## 4.23.4

### Patch Changes

- [#2606](https://github.com/statelyai/xstate/pull/2606) [`01e5d7984`](https://github.com/statelyai/xstate/commit/01e5d7984a5441a6980eacdb06d42c2a9398bdff) Thanks [@davidkpiano](https://github.com/statelyai)! - The following utility types were previously returning `never` in some unexpected cases, and are now working as expected:

  - `ContextFrom<T>`
  - `EventFrom<T>`
  - `EmittedFrom<T>`

## 4.23.3

### Patch Changes

- [#2587](https://github.com/statelyai/xstate/pull/2587) [`5aaa8445c`](https://github.com/statelyai/xstate/commit/5aaa8445c0041c6e9c47285c18e8b71cb2d805a7) Thanks [@Andarist](https://github.com/Andarist)! - Allow for guards to be always resolved from the implementations object. This allows a guard implementation to be updated in the running service by `@xstate/react`.

## 4.23.2

### Patch Changes

- [`6c3f15c9`](https://github.com/statelyai/xstate/commit/6c3f15c967c816d5d9d235466e1cb1d030deb4a8) [#2551](https://github.com/statelyai/xstate/pull/2551) Thanks [@mattpocock](https://github.com/mattpocock)! - Widened the \*From utility types to allow extracting from factory functions.

  This allows for:

  ```ts
  const makeMachine = () => createMachine({});

  type Interpreter = InterpreterFrom<typeof makeMachine>;
  type Actor = ActorRefFrom<typeof makeMachine>;
  type Context = ContextFrom<typeof makeMachine>;
  type Event = EventsFrom<typeof makeMachine>;
  ```

  This also works for models, behaviours, and other actor types.

  The previous method for doing this was a good bit more verbose:

  ```ts
  const makeMachine = () => createMachine({});

  type Interpreter = InterpreterFrom<ReturnType<typeof machine>>;
  ```

* [`413a4578`](https://github.com/statelyai/xstate/commit/413a4578cded21beffff822d1485a3725457b768) [#2491](https://github.com/statelyai/xstate/pull/2491) Thanks [@davidkpiano](https://github.com/statelyai)! - The custom `.toString()` method on action objects is now removed which improves performance in larger applications (see [#2488](https://github.com/statelyai/xstate/discussions/2488) for more context).

- [`5e1223cd`](https://github.com/statelyai/xstate/commit/5e1223cd58485045b192677753946df2c00eddf7) [#2422](https://github.com/statelyai/xstate/pull/2422) Thanks [@davidkpiano](https://github.com/statelyai)! - The `context` property has been removed from `StateNodeConfig`, as it has never been allowed, nor has it ever done anything. The previous typing was unsafe and allowed `context` to be specified on nested state nodes:

  ```ts
  createMachine({
    context: {
      /* ... */
    }, // ✅ This is allowed
    initial: 'inner',
    states: {
      inner: {
        context: {
          /* ... */
        } // ❌ This will no longer compile
      }
    }
  });
  ```

* [`5b70c2ff`](https://github.com/statelyai/xstate/commit/5b70c2ff21cc5d8c6cf1c13b6eb7bb12611a9835) [#2508](https://github.com/statelyai/xstate/pull/2508) Thanks [@davidkpiano](https://github.com/statelyai)! - A race condition occurred when a child service is immediately stopped and the parent service tried to remove it from its undefined state (during its own initialization). This has been fixed, and the race condition no longer occurs. See [this issue](https://github.com/statelyai/xstate/issues/2507) for details.

- [`5a9500d1`](https://github.com/statelyai/xstate/commit/5a9500d1cde9bf2300a85bc81529da83f2d08361) [#2522](https://github.com/statelyai/xstate/pull/2522) Thanks [@farskid](https://github.com/farskid), [@Andarist](https://github.com/Andarist)! - Adjusted TS type definitions of the `withContext` and `withConfig` methods so that they accept "lazy context" now.

  Example:

  ```js
  const copy = machine.withContext(() => ({
    ref: spawn(() => {})
  }));
  ```

* [`84f9fcae`](https://github.com/statelyai/xstate/commit/84f9fcae7d2b7f99800cc3bf18097ed45c48f0f5) [#2540](https://github.com/statelyai/xstate/pull/2540) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an issue with `state.hasTag('someTag')` crashing when the `state` was rehydrated.

- [`c17dd376`](https://github.com/statelyai/xstate/commit/c17dd37621a2ba46967926d550c70a35bba7024c) [#2496](https://github.com/statelyai/xstate/pull/2496) Thanks [@VanTanev](https://github.com/VanTanev)! - Add utility type `EmittedFrom<T>` that extracts `Emitted` type from any type which can emit data

## 4.23.1

### Patch Changes

- [`141c91cf`](https://github.com/statelyai/xstate/commit/141c91cffd1d7c1ec2e82186834cb977b72fb4d4) [#2436](https://github.com/statelyai/xstate/pull/2436) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an issue where, when using `model.createMachine`, state's context was incorrectly inferred as `any` after refinement with `.matches(...)`, e.g.

  ```ts
  // `state.context` became `any` erroneously
  if (state.matches('inactive')) {
    console.log(state.context.count);
  }
  ```

## 4.23.0

### Minor Changes

- [`7dc7ceb8`](https://github.com/statelyai/xstate/commit/7dc7ceb8707569b48ceb35069125763a701a0a58) [#2379](https://github.com/statelyai/xstate/pull/2379) Thanks [@davidkpiano](https://github.com/statelyai)! - There is a new `.preserveActionOrder` (default: `false`) setting in the machine configuration that preserves the order of actions when set to `true`. Normally, actions are executed in order _except_ for `assign(...)` actions, which are prioritized and executed first. When `.preserveActionOrder` is set to `true`, `assign(...)` actions will _not_ be prioritized, and will instead run in order. As a result, actions will capture the **intermediate `context` values** instead of the resulting `context` value from all `assign(...)` actions.

  ```ts
  // With `.preserveActionOrder: true`
  const machine = createMachine({
    context: { count: 0 },
    entry: [
      ctx => console.log(ctx.count), // 0
      assign({ count: ctx => ctx.count + 1 }),
      ctx => console.log(ctx.count), // 1
      assign({ count: ctx => ctx.count + 1 }),
      ctx => console.log(ctx.count) // 2
    ],
    preserveActionOrder: true
  });

  // With `.preserveActionOrder: false` (default)
  const machine = createMachine({
    context: { count: 0 },
    entry: [
      ctx => console.log(ctx.count), // 2
      assign({ count: ctx => ctx.count + 1 }),
      ctx => console.log(ctx.count), // 2
      assign({ count: ctx => ctx.count + 1 }),
      ctx => console.log(ctx.count) // 2
    ]
    // preserveActionOrder: false
  });
  ```

### Patch Changes

- [`4e305372`](https://github.com/statelyai/xstate/commit/4e30537266eb082ccd85f050c9372358247b4167) [#2361](https://github.com/statelyai/xstate/pull/2361) Thanks [@woutermont](https://github.com/woutermont)! - Add type for `Symbol.observable` to the `Interpreter` to improve the compatibility with RxJS.

* [`1def6cf6`](https://github.com/statelyai/xstate/commit/1def6cf6109867a87b4323ee83d20a9ee0c49d7b) [#2374](https://github.com/statelyai/xstate/pull/2374) Thanks [@davidkpiano](https://github.com/statelyai)! - Existing actors can now be identified in `spawn(...)` calls by providing an `id`. This allows them to be referenced by string:

  ```ts
  const machine = createMachine({
    context: () => ({
      someRef: spawn(someExistingRef, 'something')
    }),
    on: {
      SOME_EVENT: {
        actions: send('AN_EVENT', { to: 'something' })
      }
    }
  });
  ```

- [`da6861e3`](https://github.com/statelyai/xstate/commit/da6861e34a2b28bf6eeaa7c04a2d4cf9a90f93f1) [#2391](https://github.com/statelyai/xstate/pull/2391) Thanks [@davidkpiano](https://github.com/statelyai)! - There are two new helper types for extracting `context` and `event` types:

  - `ContextFrom<T>` which extracts the `context` from any type that uses context
  - `EventFrom<T>` which extracts the `event` type (which extends `EventObject`) from any type which uses events

## 4.22.0

### Minor Changes

- [`1b32aa0d`](https://github.com/statelyai/xstate/commit/1b32aa0d3a0eca11ffcb7ec9d710eb8828107aa0) [#2356](https://github.com/statelyai/xstate/pull/2356) Thanks [@davidkpiano](https://github.com/statelyai)! - The model created from `createModel(...)` now provides a `.createMachine(...)` method that does not require passing any generic type parameters:

  ```diff
  const model = createModel(/* ... */);

  -const machine = createMachine<typeof model>(/* ... */);
  +const machine = model.createMachine(/* ... */);
  ```

* [`432b60f7`](https://github.com/statelyai/xstate/commit/432b60f7bcbcee9510e0d86311abbfd75b1a674e) [#2280](https://github.com/statelyai/xstate/pull/2280) Thanks [@davidkpiano](https://github.com/statelyai)! - Actors can now be invoked/spawned from reducers using the `fromReducer(...)` behavior creator:

  ```ts
  import { fromReducer } from 'xstate/lib/behaviors';

  type CountEvent = { type: 'INC' } | { type: 'DEC' };

  const countReducer = (count: number, event: CountEvent): number => {
    if (event.type === 'INC') {
      return count + 1;
    } else if (event.type === 'DEC') {
      return count - 1;
    }

    return count;
  };

  const countMachine = createMachine({
    invoke: {
      id: 'count',
      src: () => fromReducer(countReducer, 0)
    },
    on: {
      INC: {
        actions: forwardTo('count')
      },
      DEC: {
        actions: forwardTo('count')
      }
    }
  });
  ```

- [`f9bcea2c`](https://github.com/statelyai/xstate/commit/f9bcea2ce909ac59fcb165b352a7b51a8b29a56d) [#2366](https://github.com/statelyai/xstate/pull/2366) Thanks [@davidkpiano](https://github.com/statelyai)! - Actors can now be spawned directly in the initial `machine.context` using lazy initialization, avoiding the need for intermediate states and unsafe typings for immediately spawned actors:

  ```ts
  const machine = createMachine<{ ref: ActorRef<SomeEvent> }>({
    context: () => ({
      ref: spawn(anotherMachine, 'some-id') // spawn immediately!
    })
    // ...
  });
  ```

## 4.20.2

### Patch Changes

- [`1ef29e83`](https://github.com/statelyai/xstate/commit/1ef29e83e14331083279d50fd3a8907eb63793eb) [#2343](https://github.com/statelyai/xstate/pull/2343) Thanks [@davidkpiano](https://github.com/statelyai)! - Eventless ("always") transitions will no longer be ignored if an event is sent to a machine in a state that does not have any enabled transitions for that event.

## 4.20.1

### Patch Changes

- [`99bc5fb9`](https://github.com/statelyai/xstate/commit/99bc5fb9d1d7be35f4c767dcbbf5287755b306d0) [#2275](https://github.com/statelyai/xstate/pull/2275) Thanks [@davidkpiano](https://github.com/statelyai)! - The `SpawnedActorRef` TypeScript interface has been deprecated in favor of a unified `ActorRef` interface, which contains the following:

  ```ts
  interface ActorRef<TEvent extends EventObject, TEmitted = any>
    extends Subscribable<TEmitted> {
    send: (event: TEvent) => void;
    id: string;
    subscribe(observer: Observer<T>): Subscription;
    subscribe(
      next: (value: T) => void,
      error?: (error: any) => void,
      complete?: () => void
    ): Subscription;
    getSnapshot: () => TEmitted | undefined;
  }
  ```

  For simpler actor-ref-like objects, the `BaseActorRef<TEvent>` interface has been introduced.

  ```ts
  interface BaseActorRef<TEvent extends EventObject> {
    send: (event: TEvent) => void;
  }
  ```

* [`38e6a5e9`](https://github.com/statelyai/xstate/commit/38e6a5e98a1dd54b4f2ef96942180ec0add88f2b) [#2334](https://github.com/statelyai/xstate/pull/2334) Thanks [@davidkpiano](https://github.com/statelyai)! - When using a model type in `createMachine<typeof someModel>(...)`, TypeScript will no longer compile machines that are missing the `context` property in the machine configuration:

  ```ts
  const machine = createMachine<typeof someModel>({
    // missing context - will give a TS error!
    // context: someModel.initialContext,
    initial: 'somewhere',
    states: {
      somewhere: {}
    }
  });
  ```

- [`5f790ba5`](https://github.com/statelyai/xstate/commit/5f790ba5478cb733a59e3b0603e8976c11bcdd04) [#2320](https://github.com/statelyai/xstate/pull/2320) Thanks [@davidkpiano](https://github.com/statelyai)! - The typing for `InvokeCallback` have been improved for better event constraints when using the `sendBack` parameter of invoked callbacks:

  ```ts
  invoke: () => (sendBack, receive) => {
    // Will now be constrained to events that the parent machine can receive
    sendBack({ type: 'SOME_EVENT' });
  };
  ```

* [`2de3ec3e`](https://github.com/statelyai/xstate/commit/2de3ec3e994e0deb5a142aeac15e1eddeb18d1e1) [#2272](https://github.com/statelyai/xstate/pull/2272) Thanks [@davidkpiano](https://github.com/statelyai)! - The `state.meta` value is now calculated directly from `state.configuration`. This is most useful when starting a service from a persisted state:

  ```ts
    const machine = createMachine({
      id: 'test',
      initial: 'first',
      states: {
        first: {
          meta: {
            name: 'first state'
          }
        },
        second: {
          meta: {
            name: 'second state'
          }
        }
      }
    });

    const service = interpret(machine);

    service.start('second'); // `meta` will be computed

    // the state will have
    // meta: {
    //   'test.second': {
    //     name: 'second state'
    //   }
    // }
  });
  ```

## 4.20.0

### Minor Changes

- [`28059b9f`](https://github.com/statelyai/xstate/commit/28059b9f09926d683d80b7d816f5b703c0667a9f) [#2197](https://github.com/statelyai/xstate/pull/2197) Thanks [@davidkpiano](https://github.com/statelyai)! - All spawned and invoked actors now have a `.getSnapshot()` method, which allows you to retrieve the latest value emitted from that actor. That value may be `undefined` if no value has been emitted yet.

  ```js
  const machine = createMachine({
    context: {
      promiseRef: null
    },
    initial: 'pending',
    states: {
      pending: {
        entry: assign({
          promiseRef: () => spawn(fetch(/* ... */), 'some-promise')
        })
      }
    }
  });

  const service = interpret(machine)
    .onTransition(state => {
      // Read promise value synchronously
      const resolvedValue = state.context.promiseRef?.getSnapshot();
      // => undefined (if promise not resolved yet)
      // => { ... } (resolved data)
    })
    .start();

  // ...
  ```

### Patch Changes

- [`4ef03465`](https://github.com/statelyai/xstate/commit/4ef03465869e27dc878ec600661c9253d90f74f0) [#2240](https://github.com/statelyai/xstate/pull/2240) Thanks [@VanTanev](https://github.com/VanTanev)! - Preserve StateMachine type when .withConfig() and .withContext() modifiers are used on a machine.

## 4.19.2

### Patch Changes

- [`18789aa9`](https://github.com/statelyai/xstate/commit/18789aa94669e48b71e2ae22e524d9bbe9dbfc63) [#2107](https://github.com/statelyai/xstate/pull/2107) Thanks [@woutermont](https://github.com/woutermont)! - This update restricts invoked `Subscribable`s to `EventObject`s,
  so that type inference can be done on which `Subscribable`s are
  allowed to be invoked. Existing `MachineConfig`s that invoke
  `Subscribable<any>`s that are not `Subscribable<EventObject>`s
  should be updated accordingly.

* [`38dcec1d`](https://github.com/statelyai/xstate/commit/38dcec1dad60c62cf8c47c88736651483276ff87) [#2149](https://github.com/statelyai/xstate/pull/2149) Thanks [@davidkpiano](https://github.com/statelyai)! - Invocations and entry actions for _combinatorial_ machines (machines with only a single root state) now behave predictably and will not re-execute upon targetless transitions.

## 4.19.1

### Patch Changes

- [`64ab1150`](https://github.com/statelyai/xstate/commit/64ab1150e0a383202f4af1d586b28e081009c929) [#2173](https://github.com/statelyai/xstate/pull/2173) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an issue with tags not being set correctly after sending an event to a machine that didn't result in selecting any transitions.

## 4.19.0

### Minor Changes

- [`4f2f626d`](https://github.com/statelyai/xstate/commit/4f2f626dc84f45bb18ded6dd9aad3b6f6a2190b1) [#2143](https://github.com/statelyai/xstate/pull/2143) Thanks [@davidkpiano](https://github.com/statelyai)! - Tags can now be added to state node configs under the `.tags` property:

  ```js
  const machine = createMachine({
    initial: 'green',
    states: {
      green: {
        tags: 'go' // single tag
      },
      yellow: {
        tags: 'go'
      },
      red: {
        tags: ['stop', 'other'] // multiple tags
      }
    }
  });
  ```

  You can query whether a state has a tag via `state.hasTag(tag)`:

  ```js
  const canGo = state.hasTag('go');
  // => `true` if in 'green' or 'red' state
  ```

### Patch Changes

- [`a61d01ce`](https://github.com/statelyai/xstate/commit/a61d01cefab5734adf9bfb167291f5b0ba712684) [#2125](https://github.com/statelyai/xstate/pull/2125) Thanks [@VanTanev](https://github.com/VanTanev)! - In callback invokes, the types of `callback` and `onReceive` are properly scoped to the machine TEvent.

## 4.18.0

### Minor Changes

- [`d0939ec6`](https://github.com/statelyai/xstate/commit/d0939ec60161c34b053cecdaeb277606b5982375) [#2046](https://github.com/statelyai/xstate/pull/2046) Thanks [@SimeonC](https://github.com/SimeonC)! - Allow machines to communicate with the inspector even in production builds.

* [`e37fffef`](https://github.com/statelyai/xstate/commit/e37fffefb742f45765945c02727edfbd5e2f9d47) [#2079](https://github.com/statelyai/xstate/pull/2079) Thanks [@davidkpiano](https://github.com/statelyai)! - There is now support for "combinatorial machines" (state machines that only have one state):

  ```js
  const testMachine = createMachine({
    context: { value: 42 },
    on: {
      INC: {
        actions: assign({ value: ctx => ctx.value + 1 })
      }
    }
  });
  ```

  These machines omit the `initial` and `state` properties, as the entire machine is treated as a single state.

### Patch Changes

- [`6a9247d4`](https://github.com/statelyai/xstate/commit/6a9247d4d3a39e6c8c4724d3368a13fcdef10907) [#2102](https://github.com/statelyai/xstate/pull/2102) Thanks [@VanTanev](https://github.com/VanTanev)! - Provide a convenience type for getting the `Interpreter` type based on the `StateMachine` type by transferring all generic parameters onto it. It can be used like this: `InterpreterFrom<typeof machine>`

## 4.17.1

### Patch Changes

- [`33302814`](https://github.com/statelyai/xstate/commit/33302814c38587d0044afd2ae61a4ff4779416c6) [#2041](https://github.com/statelyai/xstate/pull/2041) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an issue with creatorless models not being correctly matched by `createMachine`'s overload responsible for using model-induced types.

## 4.17.0

### Minor Changes

- [`7763db8d`](https://github.com/statelyai/xstate/commit/7763db8d3615321d03839b2bd31c9b118ddee50c) [#1977](https://github.com/statelyai/xstate/pull/1977) Thanks [@davidkpiano](https://github.com/statelyai)! - The `schema` property has been introduced to the machine config passed into `createMachine(machineConfig)`, which allows you to provide metadata for the following:

  - Context
  - Events
  - Actions
  - Guards
  - Services

  This metadata can be accessed as-is from `machine.schema`:

  ```js
  const machine = createMachine({
    schema: {
      // Example in JSON Schema (anything can be used)
      context: {
        type: 'object',
        properties: {
          foo: { type: 'string' },
          bar: { type: 'number' },
          baz: {
            type: 'object',
            properties: {
              one: { type: 'string' }
            }
          }
        }
      },
      events: {
        FOO: { type: 'object' },
        BAR: { type: 'object' }
      }
    }
    // ...
  });
  ```

  Additionally, the new `createSchema()` identity function allows any schema "metadata" to be represented by a specific type, which makes type inference easier without having to specify generic types:

  ```ts
  import { createSchema, createMachine } from 'xstate';

  // Both `context` and `events` are inferred in the rest of the machine!
  const machine = createMachine({
    schema: {
      context: createSchema<{ count: number }>(),
      // No arguments necessary
      events: createSchema<{ type: 'FOO' } | { type: 'BAR' }>()
    }
    // ...
  });
  ```

* [`5febfe83`](https://github.com/statelyai/xstate/commit/5febfe83a7e5e866c0a4523ea4f86a966af7c50f) [#1955](https://github.com/statelyai/xstate/pull/1955) Thanks [@davidkpiano](https://github.com/statelyai)! - Event creators can now be modeled inside of the 2nd argument of `createModel()`, and types for both `context` and `events` will be inferred properly in `createMachine()` when given the `typeof model` as the first generic parameter.

  ```ts
  import { createModel } from 'xstate/lib/model';

  const userModel = createModel(
    // initial context
    {
      name: 'David',
      age: 30
    },
    // creators (just events for now)
    {
      events: {
        updateName: (value: string) => ({ value }),
        updateAge: (value: number) => ({ value }),
        anotherEvent: () => ({}) // no payload
      }
    }
  );

  const machine = createMachine<typeof userModel>({
    context: userModel.initialContext,
    initial: 'active',
    states: {
      active: {
        on: {
          updateName: {
            /* ... */
          },
          updateAge: {
            /* ... */
          }
        }
      }
    }
  });

  const nextState = machine.transition(
    undefined,
    userModel.events.updateName('David')
  );
  ```

## 4.16.2

### Patch Changes

- [`4194ffe8`](https://github.com/statelyai/xstate/commit/4194ffe84cfe7910e2c183701e36bc5cac5c9bcc) [#1710](https://github.com/statelyai/xstate/pull/1710) Thanks [@davidkpiano](https://github.com/statelyai)! - Stopping an already stopped interpreter will no longer crash. See [#1697](https://github.com/statelyai/xstate/issues/1697) for details.

## 4.16.1

### Patch Changes

- [`af6b7c70`](https://github.com/statelyai/xstate/commit/af6b7c70015db29d84f79dfd29ea0dc221b8f3e6) [#1865](https://github.com/statelyai/xstate/pull/1865) Thanks [@Andarist](https://github.com/Andarist)! - Improved `.matches(value)` inference for typestates containing union types as values.

## 4.16.0

### Minor Changes

- [`d2e328f8`](https://github.com/statelyai/xstate/commit/d2e328f8efad7e8d3500d39976d1153a26e835a3) [#1439](https://github.com/statelyai/xstate/pull/1439) Thanks [@davidkpiano](https://github.com/statelyai)! - An opt-in `createModel()` helper has been introduced to make it easier to work with typed `context` and events.

  - `createModel(initialContext)` creates a `model` object
  - `model.initialContext` returns the `initialContext`
  - `model.assign(assigner, event?)` creates an `assign` action that is properly scoped to the `event` in TypeScript

  See https://github.com/statelyai/xstate/pull/1439 for more details.

  ```js
  import { createMachine } from 'xstate';
  import { createModel } from 'xstate/lib/model'; // opt-in, not part of main build

  interface UserContext {
    name: string;
    age: number;
  }

  type UserEvents =
    | { type: 'updateName'; value: string }
    | { type: 'updateAge'; value: number }

  const userModel = createModel<UserContext, UserEvents>({
    name: 'David',
    age: 30
  });

  const assignName = userModel.assign({
    name: (_, e) => e.value // correctly typed to `string`
  }, 'updateName'); // restrict to 'updateName' event

  const machine = createMachine<UserContext, UserEvents>({
    context: userModel.context,
    initial: 'active',
    states: {
      active: {
        on: {
          updateName: {
            actions: assignName
          }
        }
      }
    }
  });
  ```

## 4.15.4

### Patch Changes

- [`0cb8df9b`](https://github.com/statelyai/xstate/commit/0cb8df9b6c8cd01ada82afe967bf1015e24e75d9) [#1816](https://github.com/statelyai/xstate/pull/1816) Thanks [@Andarist](https://github.com/Andarist)! - `machine.resolveState(state)` calls should resolve to the correct value of `.done` property now.

## 4.15.3

### Patch Changes

- [`63ba888e`](https://github.com/statelyai/xstate/commit/63ba888e19bd2b72f9aad2c9cd36cde297e0ffe5) [#1770](https://github.com/statelyai/xstate/pull/1770) Thanks [@davidkpiano](https://github.com/statelyai)! - Instead of referencing `window` directly, XState now internally calls a `getGlobal()` function that will resolve to the proper `globalThis` value in all environments. This affects the dev tools code only.

## 4.15.2

### Patch Changes

- [`497c543d`](https://github.com/statelyai/xstate/commit/497c543d2980ea1a277b30b340a7bcd3dd0b3cb6) [#1766](https://github.com/statelyai/xstate/pull/1766) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an issue with events received from callback actors not having the appropriate `_event.origin` set.

## 4.15.1

### Patch Changes

- [`8a8cfa32`](https://github.com/statelyai/xstate/commit/8a8cfa32d99aedf11f4af93ba56fa9ba68925c74) [#1704](https://github.com/statelyai/xstate/pull/1704) Thanks [@blimmer](https://github.com/blimmer)! - The default `clock` methods (`setTimeout` and `clearTimeout`) are now invoked properly with the global context preserved for those invocations which matter for some JS environments. More details can be found in the corresponding issue: [#1703](https://github.com/statelyai/xstate/issues/1703).

## 4.15.0

### Minor Changes

- [`6596d0ba`](https://github.com/statelyai/xstate/commit/6596d0ba163341fc43d214b48115536cb4815b68) [#1622](https://github.com/statelyai/xstate/pull/1622) Thanks [@davidkpiano](https://github.com/statelyai)! - Spawned/invoked actors and interpreters are now typed as extending `ActorRef` (e.g., `SpawnedActorRef`) rather than `Actor` or `Interpreter`. This unification of types should make it more straightforward to provide actor types:

  ```diff
  import {
  - Actor
  + ActorRef
  } from 'xstate';

  // ...

  interface SomeContext {
  - server?: Actor;
  + server?: ActorRef<ServerEvent>;
  }
  ```

  It's also easier to specify the type of a spawned/invoked machine with `ActorRefFrom`:

  ```diff
  import {
    createMachine,
  - Actor
  + ActorRefFrom
  } from 'xstate';

  const serverMachine = createMachine<ServerContext, ServerEvent>({
    // ...
  });

  interface SomeContext {
  - server?: Actor; // difficult to type
  + server?: ActorRefFrom<typeof serverMachine>;
  }
  ```

### Patch Changes

- [`75a91b07`](https://github.com/statelyai/xstate/commit/75a91b078a10a86f13edc9eec3ac1d6246607002) [#1692](https://github.com/statelyai/xstate/pull/1692) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an issue with history state entering a wrong state if the most recent visit in its parent has been caused by a transient transition.

## 4.14.1

### Patch Changes

- [`02c76350`](https://github.com/statelyai/xstate/commit/02c763504da0808eeb281587981a5baf8ba884a1) [#1656](https://github.com/statelyai/xstate/pull/1656) Thanks [@Andarist](https://github.com/Andarist)! - Exit actions will now be properly called when a service gets canceled by calling its `stop` method.

## 4.14.0

### Minor Changes

- [`119db8fb`](https://github.com/statelyai/xstate/commit/119db8fbccd08f899e1275a502d8c4c51b5a130e) [#1577](https://github.com/statelyai/xstate/pull/1577) Thanks [@davidkpiano](https://github.com/statelyai)! - Expressions can now be used in the `stop()` action creator:

  ```js
  // ...
  actions: stop(context => context.someActor);
  ```

### Patch Changes

- [`8c78e120`](https://github.com/statelyai/xstate/commit/8c78e1205a729d933e30db01cd4260d82352a9be) [#1570](https://github.com/statelyai/xstate/pull/1570) Thanks [@davidkpiano](https://github.com/statelyai)! - The return type of `spawn(machine)` will now be `Actor<State<TContext, TEvent>, TEvent>`, which is a supertype of `Interpreter<...>`.

* [`602687c2`](https://github.com/statelyai/xstate/commit/602687c235c56cca552c2d5a9d78adf224f522d8) [#1566](https://github.com/statelyai/xstate/pull/1566) Thanks [@davidkpiano](https://github.com/statelyai)! - Exit actions will now be properly called when an invoked machine reaches its final state. See [#1109](https://github.com/statelyai/xstate/issues/1109) for more details.

- [`6e44d02a`](https://github.com/statelyai/xstate/commit/6e44d02ad03af4041046120dd6c975e3b5b3772a) [#1553](https://github.com/statelyai/xstate/pull/1553) Thanks [@davidkpiano](https://github.com/statelyai)! - The `state.children` property now properly shows all spawned and invoked actors. See [#795](https://github.com/statelyai/xstate/issues/795) for more details.

* [`72b0880e`](https://github.com/statelyai/xstate/commit/72b0880e6444ae009adca72088872bb5c0760ce3) [#1504](https://github.com/statelyai/xstate/pull/1504) Thanks [@Andarist](https://github.com/Andarist)! - Added `status` property on the `Interpreter` - this can be used to differentiate not started, running and stopped interpreters. This property is best compared to values on the new `InterpreterStatus` export.

## 4.13.0

### Minor Changes

- [`f51614df`](https://github.com/statelyai/xstate/commit/f51614dff760cfe4511c0bc7cca3d022157c104c) [#1409](https://github.com/statelyai/xstate/pull/1409) Thanks [@jirutka](https://github.com/jirutka)! - Fix type `ExtractStateValue` so that it generates a type actually describing a `State.value`

### Patch Changes

- [`b1684ead`](https://github.com/statelyai/xstate/commit/b1684eadb1f859db5c733b8d403afc825c294948) [#1402](https://github.com/statelyai/xstate/pull/1402) Thanks [@Andarist](https://github.com/Andarist)! - Improved TypeScript type-checking performance a little bit by using distributive conditional type within `TransitionsConfigArray` declarations instead of a mapped type. Kudos to [@amcasey](https://github.com/amcasey), some discussion around this can be found [here](https://github.com/microsoft/TypeScript/issues/39826#issuecomment-675790689)

* [`ad3026d4`](https://github.com/statelyai/xstate/commit/ad3026d4309e9a1c719e09fd8c15cdfefce22055) [#1407](https://github.com/statelyai/xstate/pull/1407) Thanks [@tomenden](https://github.com/tomenden)! - Fixed an issue with not being able to run XState in Web Workers due to assuming that `window` or `global` object is available in the executing environment, but none of those are actually available in the Web Workers context.

- [`4e949ec8`](https://github.com/statelyai/xstate/commit/4e949ec856349062352562c825beb0654e528f81) [#1401](https://github.com/statelyai/xstate/pull/1401) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an issue with spawned actors being spawned multiple times when they got spawned in an initial state of a child machine that is invoked in the initial state of a parent machine.

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

- [`b72e29dd`](https://github.com/statelyai/xstate/commit/b72e29dd728b4c1be4bdeaec93909b4e307db5cf) [#1354](https://github.com/statelyai/xstate/pull/1354) Thanks [@davidkpiano](https://github.com/statelyai)! - The `Action` type was simplified, and as a result, you should see better TypeScript performance.

* [`4dbabfe7`](https://github.com/statelyai/xstate/commit/4dbabfe7d5ba154e852b4d460a2434c6fc955726) [#1320](https://github.com/statelyai/xstate/pull/1320) Thanks [@davidkpiano](https://github.com/statelyai)! - The `invoke.src` property now accepts an object that describes the invoke source with its `type` and other related metadata. This can be read from the `services` option in the `meta.src` argument:

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

- [`8662e543`](https://github.com/statelyai/xstate/commit/8662e543393de7e2f8a6d92ff847043781d10f4d) [#1317](https://github.com/statelyai/xstate/pull/1317) Thanks [@Andarist](https://github.com/Andarist)! - All `TTypestate` type parameters default to `{ value: any; context: TContext }` now and the parametrized type is passed correctly between various types which results in more accurate types involving typestates.

### Patch Changes

- [`3ab3f25e`](https://github.com/statelyai/xstate/commit/3ab3f25ea297e4d770eef512e9583475c943845d) [#1285](https://github.com/statelyai/xstate/pull/1285) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an issue with initial state of invoked machines being read without custom data passed to them which could lead to a crash when evaluating transient transitions for the initial state.

* [`a7da1451`](https://github.com/statelyai/xstate/commit/a7da14510fd1645ad041836b567771edb5b90827) [#1290](https://github.com/statelyai/xstate/pull/1290) Thanks [@davidkpiano](https://github.com/statelyai)! - The "Attempted to spawn an Actor [...] outside of a service. This will have no effect." warnings are now silenced for "lazily spawned" actors, which are actors that aren't immediately active until the function that creates them are called:

  ```js
  // ⚠️ "active" actor - will warn
  spawn(somePromise);

  // 🕐 "lazy" actor - won't warn
  spawn(() => somePromise);

  // 🕐 machines are also "lazy" - won't warn
  spawn(someMachine);
  ```

  It is recommended that all `spawn(...)`-ed actors are lazy, to avoid accidentally initializing them e.g., when reading `machine.initialState` or calculating otherwise pure transitions. In V5, this will be enforced.

- [`c1f3d260`](https://github.com/statelyai/xstate/commit/c1f3d26069ee70343f8045a48411e02a68f98cbd) [#1317](https://github.com/statelyai/xstate/pull/1317) Thanks [@Andarist](https://github.com/Andarist)! - Fixed a type returned by a `raise` action - it's now `RaiseAction<TEvent> | SendAction<TContext, AnyEventObject, TEvent>` instead of `RaiseAction<TEvent> | SendAction<TContext, TEvent, TEvent>`. This makes it comaptible in a broader range of scenarios.

* [`8270d5a7`](https://github.com/statelyai/xstate/commit/8270d5a76c71add3a5109e069bd85716b230b5d4) [#1372](https://github.com/statelyai/xstate/pull/1372) Thanks [@christianchown](https://github.com/christianchown)! - Narrowed the `ServiceConfig` type definition to use a specific event type to prevent compilation errors on strictly-typed `MachineOptions`.

- [`01e3e2dc`](https://github.com/statelyai/xstate/commit/01e3e2dcead63dce3eef5ab745395584efbf05fa) [#1320](https://github.com/statelyai/xstate/pull/1320) Thanks [@davidkpiano](https://github.com/statelyai)! - The JSON definition for `stateNode.invoke` objects will no longer include the `onDone` and `onError` transitions, since those transitions are already merged into the `transitions` array. This solves the issue of reviving a serialized machine from JSON, where before, the `onDone` and `onError` transitions for invocations were wrongly duplicated.

## 4.11.0

### Minor Changes

- [`36ed8d0a`](https://github.com/statelyai/xstate/commit/36ed8d0a3adf5b7fd187b0abe198220398e8b056) [#1262](https://github.com/statelyai/xstate/pull/1262) Thanks [@Andarist](https://github.com/Andarist)! - Improved type inference for `InvokeConfig['data']`. This has required renaming `data` property on `StateNode` instances to `doneData`. This property was never meant to be a part of the public API, so we don't consider this to be a breaking change.

* [`2c75ab82`](https://github.com/statelyai/xstate/commit/2c75ab822e49cb1a23c1e14eb7bd04548ab143eb) [#1219](https://github.com/statelyai/xstate/pull/1219) Thanks [@davidkpiano](https://github.com/statelyai)! - The resolved value of the `invoke.data` property is now available in the "invoke meta" object, which is passed as the 3rd argument to the service creator in `options.services`. This will work for all types of invoked services now, including promises, observables, and callbacks.

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

- [`a6c78ae9`](https://github.com/statelyai/xstate/commit/a6c78ae960acba36b61a41a5d154ea59908010b0) [#1249](https://github.com/statelyai/xstate/pull/1249) Thanks [@davidkpiano](https://github.com/statelyai)! - New property introduced for eventless (transient) transitions: **`always`**, which indicates a transition that is always taken when in that state. Empty string transition configs for [transient transitions](https://xstate.js.org/docs/guides/transitions.html#transient-transitions) are deprecated in favor of `always`:

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

- [`36ed8d0a`](https://github.com/statelyai/xstate/commit/36ed8d0a3adf5b7fd187b0abe198220398e8b056) [#1262](https://github.com/statelyai/xstate/pull/1262) Thanks [@Andarist](https://github.com/Andarist)! - `StateMachine<any, any, any>` is no longer a part of the `InvokeConfig` type, but rather it creates a union with `InvokeConfig` in places where it is needed. This change shouldn't affect consumers' code.

## 4.10.0

### Minor Changes

- [`0133954`](https://github.com/statelyai/xstate/commit/013395463b955e950ab24cb4be51faf524b0de6e) [#1178](https://github.com/statelyai/xstate/pull/1178) Thanks [@davidkpiano](https://github.com/statelyai)! - The types for the `send()` and `sendParent()` action creators have been changed to fix the issue of only being able to send events that the machine can receive. In reality, a machine can and should send events to other actors that it might not be able to receive itself. See [#711](https://github.com/statelyai/xstate/issues/711) for more information.

* [`a1f1239`](https://github.com/statelyai/xstate/commit/a1f1239e20e05e338ed994d031e7ef6f2f09ad68) [#1189](https://github.com/statelyai/xstate/pull/1189) Thanks [@davidkpiano](https://github.com/statelyai)! - Previously, `state.matches(...)` was problematic because it was casting `state` to `never` if it didn't match the state value. This is now fixed by making the `Typestate` resolution more granular.

- [`dbc6a16`](https://github.com/statelyai/xstate/commit/dbc6a161c068a3e12dd12452b68a66fe3f4fb8eb) [#1183](https://github.com/statelyai/xstate/pull/1183) Thanks [@davidkpiano](https://github.com/statelyai)! - Actions from a restored state provided as a custom initial state to `interpret(machine).start(initialState)` are now executed properly. See #1174 for more information.

### Patch Changes

- [`a10d604`](https://github.com/statelyai/xstate/commit/a10d604a6afcf39048b02be5436acdd197f16c2b) [#1176](https://github.com/statelyai/xstate/pull/1176) Thanks [@itfarrier](https://github.com/itfarrier)! - Fix passing state schema into State generic

* [`326db72`](https://github.com/statelyai/xstate/commit/326db725e50f7678af162626c6c7491e4364ec07) [#1185](https://github.com/statelyai/xstate/pull/1185) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an issue with invoked service not being correctly started if other service got stopped in a subsequent microstep (in response to raised or null event).

- [`c3a496e`](https://github.com/statelyai/xstate/commit/c3a496e1f92ec27db0643fd1ddc32d683db4e751) [#1160](https://github.com/statelyai/xstate/pull/1160) Thanks [@davidkpiano](https://github.com/statelyai)! - Delayed transitions defined using `after` were previously causing a circular dependency when the machine was converted using `.toJSON()`. This has now been fixed.

* [`e16e48e`](https://github.com/statelyai/xstate/commit/e16e48e05e6243a3eacca58a13d3e663cd641f55) [#1153](https://github.com/statelyai/xstate/pull/1153) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an issue with `choose` and `pure` not being able to use actions defined in options.

- [`d496ecb`](https://github.com/statelyai/xstate/commit/d496ecb11b26011f2382d1ce6c4433284a7b3e9b) [#1165](https://github.com/statelyai/xstate/pull/1165) Thanks [@davidkpiano](https://github.com/statelyai)! - XState will now warn if you define an `.onDone` transition on the root node. Root nodes which are "done" represent the machine being in its final state, and can no longer accept any events. This has been reported as confusing in [#1111](https://github.com/statelyai/xstate/issues/1111).

## 4.9.1

### Patch Changes

- [`8a97785`](https://github.com/statelyai/xstate/commit/8a97785055faaeb1b36040dd4dc04e3b90fa9ec2) [#1137](https://github.com/statelyai/xstate/pull/1137) Thanks [@davidkpiano](https://github.com/statelyai)! - Added docs for the `choose()` and `pure()` action creators, as well as exporting the `pure()` action creator in the `actions` object.

* [`e65dee9`](https://github.com/statelyai/xstate/commit/e65dee928fea60df1e9f83c82fed8102dfed0000) [#1131](https://github.com/statelyai/xstate/pull/1131) Thanks [@wKovacs64](https://github.com/wKovacs64)! - Include the new `choose` action in the `actions` export from the `xstate` core package. This was missed in v4.9.0.

## 4.9.0

### Minor Changes

- [`f3ff150`](https://github.com/statelyai/xstate/commit/f3ff150f7c50f402704d25cdc053b76836e447e3) [#1103](https://github.com/statelyai/xstate/pull/1103) Thanks [@davidkpiano](https://github.com/statelyai)! - Simplify the `TransitionConfigArray` and `TransitionConfigMap` types in order to fix excessively deep type instantiation TypeScript reports. This addresses [#1015](https://github.com/statelyai/xstate/issues/1015).

* [`6c47b66`](https://github.com/statelyai/xstate/commit/6c47b66c3289ff161dc96d9b246873f55c9e18f2) [#1076](https://github.com/statelyai/xstate/pull/1076) Thanks [@Andarist](https://github.com/Andarist)! - Added support for conditional actions. It's possible now to have actions executed based on conditions using following:

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

- [`1a129f0`](https://github.com/statelyai/xstate/commit/1a129f0f35995981c160d756a570df76396bfdbd) [#1073](https://github.com/statelyai/xstate/pull/1073) Thanks [@Andarist](https://github.com/Andarist)! - Cleanup internal structures upon receiving termination events from spawned actors.

* [`e88aa18`](https://github.com/statelyai/xstate/commit/e88aa18431629e1061b74dfd4a961b910e274e0b) [#1085](https://github.com/statelyai/xstate/pull/1085) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an issue with data expressions of root's final nodes being called twice.

- [`88b17b2`](https://github.com/statelyai/xstate/commit/88b17b2476ff9a0fbe810df9d00db32c2241cd6e) [#1090](https://github.com/statelyai/xstate/pull/1090) Thanks [@rjdestigter](https://github.com/rjdestigter)! - This change carries forward the typestate type information encoded in the arguments of the following functions and assures that the return type also has the same typestate type information:

  - Cloned state machine returned by `.withConfig`.
  - `.state` getter defined for services.
  - `start` method of services.

* [`d5f622f`](https://github.com/statelyai/xstate/commit/d5f622f68f4065a2615b5a4a1caae6b508b4840e) [#1069](https://github.com/statelyai/xstate/pull/1069) Thanks [@davidkpiano](https://github.com/statelyai)! - Loosened event type for `SendAction<TContext, AnyEventObject>`

## 4.8.0

### Minor Changes

- [`55aa589`](https://github.com/statelyai/xstate/commit/55aa589648a9afbd153e8b8e74cbf2e0ebf573fb) [#960](https://github.com/statelyai/xstate/pull/960) Thanks [@davidkpiano](https://github.com/statelyai)! - The machine can now be safely JSON-serialized, using `JSON.stringify(machine)`. The shape of this serialization is defined in `machine.schema.json` and reflected in `machine.definition`.

  Note that `onEntry` and `onExit` have been deprecated in the definition in favor of `entry` and `exit`.

### Patch Changes

- [`1ae31c1`](https://github.com/statelyai/xstate/commit/1ae31c17dc81fb63e699b4b9bf1cf4ead023001d) [#1023](https://github.com/statelyai/xstate/pull/1023) Thanks [@Andarist](https://github.com/Andarist)! - Fixed memory leak - `State` objects had been retained in closures.

## 4.7.8

### Patch Changes

- [`520580b`](https://github.com/statelyai/xstate/commit/520580b4af597f7c83c329757ae972278c2d4494) [#967](https://github.com/statelyai/xstate/pull/967) Thanks [@andrewgordstewart](https://github.com/andrewgordstewart)! - Add context & event types to InvokeConfig

## 4.7.7

### Patch Changes

- [`c8db035`](https://github.com/statelyai/xstate/commit/c8db035b90a7ab4a557359d493d3dd7973dacbdd) [#936](https://github.com/statelyai/xstate/pull/936) Thanks [@davidkpiano](https://github.com/statelyai)! - The `escalate()` action can now take in an expression, which will be evaluated against the `context`, `event`, and `meta` to return the error data.

* [`2a3fea1`](https://github.com/statelyai/xstate/commit/2a3fea18dcd5be18880ad64007d44947cc327d0d) [#952](https://github.com/statelyai/xstate/pull/952) Thanks [@davidkpiano](https://github.com/statelyai)! - The typings for the raise() action have been fixed to allow any event to be raised. This typed behavior will be refined in version 5, to limit raised events to those that the machine accepts.

- [`f86d419`](https://github.com/statelyai/xstate/commit/f86d41979ed108e2ac4df63299fc16f798da69f7) [#957](https://github.com/statelyai/xstate/pull/957) Thanks [@Andarist](https://github.com/Andarist)! - Fixed memory leak - each created service has been registered in internal map but it was never removed from it. Registration has been moved to a point where Interpreter is being started and it's deregistered when it is being stopped.

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
