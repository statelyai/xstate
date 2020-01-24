# @xstate/fsm

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
