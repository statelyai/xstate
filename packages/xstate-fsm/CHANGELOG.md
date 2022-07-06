# @xstate/fsm

## 2.0.0

### Major Changes

- [#2939](https://github.com/statelyai/xstate/pull/2939) [`360e85462`](https://github.com/statelyai/xstate/commit/360e8546298c4a06b6d51d8f12c0563672dd7acf) Thanks [@Andarist](https://github.com/Andarist)! - `.start()` (when called without any argument) now always starts from the initial state of the machine. This matches the behavior of XState itself.

### Patch Changes

- [#2939](https://github.com/statelyai/xstate/pull/2939) [`360e85462`](https://github.com/statelyai/xstate/commit/360e8546298c4a06b6d51d8f12c0563672dd7acf) Thanks [@Andarist](https://github.com/Andarist)! - A bunch of TypeScript helpers has been added: `StateMachine.AnyMachine`, `StateMachine.AnyService`, `ContextFrom`, `EventFrom`, `StateFrom` and `ServiceFrom`.

## 1.6.5

### Patch Changes

- [#3065](https://github.com/statelyai/xstate/pull/3065) [`de08b61ad`](https://github.com/statelyai/xstate/commit/de08b61adf2ad960a88085dc0f07b96fac0a8799) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an issue with `state.matches(...)` narrowing down `state` to `never` for the "alternate" branch of the code when no type states were defined.

## 1.6.4

### Patch Changes

- [#2957](https://github.com/statelyai/xstate/pull/2957) [`8550ddda7`](https://github.com/statelyai/xstate/commit/8550ddda73e2ad291e19173d7fa8d13e3336fbb9) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The repository links have been updated from `github.com/davidkpiano` to `github.com/statelyai`.

## 1.6.3

### Patch Changes

- [#2474](https://github.com/statelyai/xstate/pull/2474) Thanks [@annaghi](https://github.com/annaghi)! - Use CommonJS files as `package.json#main` (instead of UMD files) as this plays better with native ESM loader in node (and by extension fixes compatibility issues with projects like [SvelteKit](https://kit.svelte.dev/)).

## 1.6.2

### Patch Changes

- [#2601](https://github.com/statelyai/xstate/pull/2601) [`b76351be7`](https://github.com/statelyai/xstate/commit/b76351be73910a733f56059579aad1faea6bd822) Thanks [@VanTanev](https://github.com/VanTanev)! - Add `ExtractEvent<Event, EventType>` to @xstate/fsm

## 1.6.1

### Patch Changes

- [`0db3de7c`](https://github.com/statelyai/xstate/commit/0db3de7c5b84cb3eecb0cf1deabcc3bc54172505) [#2055](https://github.com/statelyai/xstate/pull/2055) Thanks [@f-elix](https://github.com/f-elix)! - Added a more helpful error, in the development build, for a situation where the next state (the target of a transition) doesn't exist in the config.

## 1.6.0

### Minor Changes

- [`b990d527`](https://github.com/statelyai/xstate/commit/b990d527b760ca6c3ed105a3af7dfcff8bc5b481) [#1911](https://github.com/statelyai/xstate/pull/1911) Thanks [@davidkpiano](https://github.com/statelyai)! - Transitions with `undefined` targets will no longer exit and re-enter the state, which means that `exit` and `entry` actions will not be executed:

  ```js
  // ...
  someState: {
    entry: [/* ... */],
    exit: [/* ... */],
    on: {
      SOME_EVENT: {
        // undefined target - will not exit/re-enter
        actions: [/* ... */]
      }
    }
  }
  // ...
  ```

## 1.5.2

### Patch Changes

- [`8b670653`](https://github.com/statelyai/xstate/commit/8b6706538ae6e5ac275b68cc4686801458bddaf8) [#1661](https://github.com/statelyai/xstate/pull/1661) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an issue with initial `assign` actions not being resolved and thus context not being updated by them.

## 1.5.1

### Patch Changes

- [`0f07c84d`](https://github.com/statelyai/xstate/commit/0f07c84daba6ca4913f5311b4e99b67cf489baba) [#1388](https://github.com/statelyai/xstate/pull/1388) Thanks [@hudecsamuel](https://github.com/hudecsamuel)! - `State['value']` is now correctly typed to `TState['value']`. It's important in situations when typestates are used as it now correctly is limited to values of those typestates and not widened to just `string`.

## 1.5.0

### Minor Changes

- [`ccefca92`](https://github.com/statelyai/xstate/commit/ccefca92a1261cf8d9a1e356557af4c8d5fbaffb) [#1267](https://github.com/statelyai/xstate/pull/1267) Thanks [@nlopin](https://github.com/nlopin)! - You can now rehydrate the state of a service by calling `start` with `initialState` argument:

  ```js
  interpret(someMachine).start('active');

  interpret(anotherMachine).start({
    value: 'active',
    context: { count: 42 }
  });
  ```

## 1.4.0

### Minor Changes

- [`3d50808`](https://github.com/statelyai/xstate/commit/3d50808ac68b1f52de49969e5e83b2c341fda525) [#1082](https://github.com/statelyai/xstate/pull/1082) Thanks [@davidkpiano](https://github.com/statelyai)! - The `.state` property is now exposed on the service returned from `interpret(machine)`, which is a getter that returns the latest state of the machine.

### Patch Changes

- [`dcbd72f`](https://github.com/statelyai/xstate/commit/dcbd72ffe1804d6c50b5ebf2d17ec2b74a8c7b58) [#1122](https://github.com/statelyai/xstate/pull/1122) Thanks [@chancestrickland](https://github.com/chancestrickland)! - `StateMachine.Config` type accepts now a third type parameter - `TState` - similarly to other existing types. When provided it provides helpful intellisense when defining the state chart transitions.

## 1.3.0

### Minor Changes

- [`7367de2`](https://github.com/statelyai/xstate/commit/7367de29a641e693702e919160292022a4d35323) [#946](https://github.com/statelyai/xstate/pull/946) Thanks [@Andarist](https://github.com/Andarist)! - Added a second, optional, `options` parameter to the `createMachine`. Currently only `actions` map can be put there - similarly how this can be done for `xstate` itself:

  <details>
  <summary>Example</summary>

  ```js
  const machine = createMachine({
    initial: 'idle'
    states: {
      idle: {
        on: {
          LOAD: {
            target: 'loading',
            actions: 'fetchData'
          }
        }
      },
      loading: {
        // ...
      }
    }
  }, {
    actions: {
      fetchData: () => /* ... */
    }
  })
  ```

  </details>

* [`3c10215`](https://github.com/statelyai/xstate/commit/3c102158d24d3f12aa671bc39dea0a2e98e3c34f) [#811](https://github.com/statelyai/xstate/pull/811) Thanks [@ghengeveld](https://github.com/ghengeveld)! - A `config` property got exposed on created machines. It's the same object which got passed in as argument.

### Patch Changes

- [`a337473`](https://github.com/statelyai/xstate/commit/a337473c669c3a486c5cfa4a0ff4956b5136053d) [#827](https://github.com/statelyai/xstate/pull/827) Thanks [@Andarist](https://github.com/Andarist)! - Fixed entry actions defined on an initial state not being executed.

## 1.2.0

### Minor Changes

- 3cda398: The `assign()` action creator is now strongly-typed, and takes the context and event types as generic parameters, just like in XState core.
- 61ccfbd: Make `interpret` default for `TEvent` type parameter more strict. It's now `EventObject` instead of `any` and it matches the default on `createMachine`.

### Patch Changes

- 15fc24c: Export `Typestate` type.
