# @xstate/fsm

## 1.6.1

### Patch Changes

- [`0db3de7c`](https://github.com/davidkpiano/xstate/commit/0db3de7c5b84cb3eecb0cf1deabcc3bc54172505) [#2055](https://github.com/davidkpiano/xstate/pull/2055) Thanks [@f-elix](https://github.com/f-elix)! - Added a more helpful error, in the development build, for a situation where the next state (the target of a transition) doesn't exist in the config.

## 1.6.0

### Minor Changes

- [`b990d527`](https://github.com/davidkpiano/xstate/commit/b990d527b760ca6c3ed105a3af7dfcff8bc5b481) [#1911](https://github.com/davidkpiano/xstate/pull/1911) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Transitions with `undefined` targets will no longer exit and re-enter the state, which means that `exit` and `entry` actions will not be executed:

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

- [`8b670653`](https://github.com/davidkpiano/xstate/commit/8b6706538ae6e5ac275b68cc4686801458bddaf8) [#1661](https://github.com/davidkpiano/xstate/pull/1661) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an issue with initial `assign` actions not being resolved and thus context not being updated by them.

## 1.5.1

### Patch Changes

- [`0f07c84d`](https://github.com/davidkpiano/xstate/commit/0f07c84daba6ca4913f5311b4e99b67cf489baba) [#1388](https://github.com/davidkpiano/xstate/pull/1388) Thanks [@hudecsamuel](https://github.com/hudecsamuel)! - `State['value']` is now correctly typed to `TState['value']`. It's important in situations when typestates are used as it now correctly is limited to values of those typestates and not widened to just `string`.

## 1.5.0

### Minor Changes

- [`ccefca92`](https://github.com/davidkpiano/xstate/commit/ccefca92a1261cf8d9a1e356557af4c8d5fbaffb) [#1267](https://github.com/davidkpiano/xstate/pull/1267) Thanks [@nlopin](https://github.com/nlopin)! - You can now rehydrate the state of a service by calling `start` with `initialState` argument:

  ```js
  interpret(someMachine).start('active');

  interpret(anotherMachine).start({
    value: 'active',
    context: { count: 42 }
  });
  ```

## 1.4.0

### Minor Changes

- [`3d50808`](https://github.com/davidkpiano/xstate/commit/3d50808ac68b1f52de49969e5e83b2c341fda525) [#1082](https://github.com/davidkpiano/xstate/pull/1082) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The `.state` property is now exposed on the service returned from `interpret(machine)`, which is a getter that returns the latest state of the machine.

### Patch Changes

- [`dcbd72f`](https://github.com/davidkpiano/xstate/commit/dcbd72ffe1804d6c50b5ebf2d17ec2b74a8c7b58) [#1122](https://github.com/davidkpiano/xstate/pull/1122) Thanks [@chancestrickland](https://github.com/chancestrickland)! - `StateMachine.Config` type accepts now a third type parameter - `TState` - similarly to other existing types. When provided it provides helpful intellisense when defining the state chart transitions.

## 1.3.0

### Minor Changes

- [`7367de2`](https://github.com/davidkpiano/xstate/commit/7367de29a641e693702e919160292022a4d35323) [#946](https://github.com/davidkpiano/xstate/pull/946) Thanks [@Andarist](https://github.com/Andarist)! - Added a second, optional, `options` parameter to the `createMachine`. Currently only `actions` map can be put there - similarly how this can be done for `xstate` itself:

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

* [`3c10215`](https://github.com/davidkpiano/xstate/commit/3c102158d24d3f12aa671bc39dea0a2e98e3c34f) [#811](https://github.com/davidkpiano/xstate/pull/811) Thanks [@ghengeveld](https://github.com/ghengeveld)! - A `config` property got exposed on created machines. It's the same object which got passed in as argument.

### Patch Changes

- [`a337473`](https://github.com/davidkpiano/xstate/commit/a337473c669c3a486c5cfa4a0ff4956b5136053d) [#827](https://github.com/davidkpiano/xstate/pull/827) Thanks [@Andarist](https://github.com/Andarist)! - Fixed entry actions defined on an initial state not being executed.

## 1.2.0

### Minor Changes

- 3cda398: The `assign()` action creator is now strongly-typed, and takes the context and event types as generic parameters, just like in XState core.
- 61ccfbd: Make `interpret` default for `TEvent` type parameter more strict. It's now `EventObject` instead of `any` and it matches the default on `createMachine`.

### Patch Changes

- 15fc24c: Export `Typestate` type.
