# @xstate/svelte

## 2.0.1

### Patch Changes

- [#3603](https://github.com/statelyai/xstate/pull/3603) [`44719c294`](https://github.com/statelyai/xstate/commit/44719c294d121e491eab19bf9dff19cf12225a1e) Thanks [@mittinatten](https://github.com/mittinatten)! - Improve performance of the `useSelector` by avoiding `get`

## 2.0.0

### Major Changes

- [#3254](https://github.com/statelyai/xstate/pull/3254) [`c0b787d2a`](https://github.com/statelyai/xstate/commit/c0b787d2a2334665af0ecb4ebc1ce5653fa3725c) Thanks [@Andarist](https://github.com/Andarist)! - The major version of this package had to be bumped to allow integrating with the typegen. This package will now require TS version 4.0 or greater.

  When using hooks from `@xstate/svelte` it's recommended to skip providing explicit generics to them. Note that that generics list has changed since v1 and we now only accept a single generic, `TMachine`.

### Patch Changes

- [#3172](https://github.com/statelyai/xstate/pull/3172) [`390a115cd`](https://github.com/statelyai/xstate/commit/390a115cd1912c017654ecd367ef9a869f7e8fe8) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an issue with the internal interpreter created by `useMachine` being unsubscribed when its subscribers' count went to zero. The lifetime of this interpreter should be bound to the lifetime of the component that has created it.

- [#3209](https://github.com/statelyai/xstate/pull/3209) [`8520e203b`](https://github.com/statelyai/xstate/commit/8520e203b60124fb66da2cedad27d0c9771dc62c) Thanks [@schibrikov](https://github.com/schibrikov)! - Added ESM build to fix some bundling issues, more information can be found [here](https://github.com/statelyai/xstate/issues/2642)

## 1.0.0

### Patch Changes

- Updated dependencies [[`360e85462`](https://github.com/statelyai/xstate/commit/360e8546298c4a06b6d51d8f12c0563672dd7acf), [`360e85462`](https://github.com/statelyai/xstate/commit/360e8546298c4a06b6d51d8f12c0563672dd7acf)]:
  - @xstate/fsm@2.0.0

## 0.2.1

### Patch Changes

- [#2957](https://github.com/statelyai/xstate/pull/2957) [`8550ddda7`](https://github.com/statelyai/xstate/commit/8550ddda73e2ad291e19173d7fa8d13e3336fbb9) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The repository links have been updated from `github.com/davidkpiano` to `github.com/statelyai`.

## 0.2.0

### Minor Changes

- [#2614](https://github.com/statelyai/xstate/pull/2614) [`0f77ec36d`](https://github.com/statelyai/xstate/commit/0f77ec36d55515beac3e1a51eb2d32bf17b94cde) Thanks [@DavKato](https://github.com/DavKato)! - Added new useSelector(actor, selector), which subscribes to actor and returns a svelte store that represents the selected state derived from selector(snapshot):

  ```svelte
  <script>
    // It won't be updated unless the selected value changed.
    const value = useSelector(service, (state) => state.context.value);
  </script>

  <p>{$value}</p>
  ```

## 0.1.1

### Patch Changes

- [`fe3e859f`](https://github.com/statelyai/xstate/commit/fe3e859f5c53813307bacad915bebc8d1f3a982c) [#2522](https://github.com/statelyai/xstate/pull/2522) Thanks [@farskid](https://github.com/farskid), [@Andarist](https://github.com/Andarist)! - Fixed an issue with actors not being spawned correctly by `useMachine` and `useInterpret` when they were defined a lazily evaluated context, like for example here:

  ```js
  createMachine({
    // lazy context
    context: () => ({
      ref: spawn(() => {})
    })
  });
  ```
