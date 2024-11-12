# @xstate/svelte

## 4.0.0

### Patch Changes

- Updated dependencies [[`8c4b70652acaef2702f32435362e4755679a516d`](https://github.com/statelyai/xstate/commit/8c4b70652acaef2702f32435362e4755679a516d)]:
  - xstate@5.19.0

## 3.0.5

### Patch Changes

- Updated dependencies [[`25963966c394fc904dc9b701a420b6e204ebe7f7`](https://github.com/statelyai/xstate/commit/25963966c394fc904dc9b701a420b6e204ebe7f7)]:
  - xstate@5.18.2

## 3.0.4

### Patch Changes

- [#5055](https://github.com/statelyai/xstate/pull/5055) [`ad38c35c37`](https://github.com/statelyai/xstate/commit/ad38c35c377d4ec5c97710fda12512abbe5f7140) Thanks [@SandroMaglione](https://github.com/SandroMaglione)! - Updated types of `useActor`, `useMachine`, and `useActorRef` to require `input` when defined inside `types/input`.

  Previously even when `input` was defined inside `types`, `useActor`, `useMachine`, and `useActorRef` would **not** make the input required:

  ```tsx
  const machine = setup({
    types: {
      input: {} as { value: number }
    }
  }).createMachine({});

  function App() {
    // Event if `input` is not defined, `useMachine` works at compile time, but risks crashing at runtime
    const _ = useMachine(machine);
    return <></>;
  }
  ```

  With this change the above code will show a type error, since `input` is now required:

  ```tsx
  const machine = setup({
    types: {
      input: {} as { value: number }
    }
  }).createMachine({});

  function App() {
    const _ = useMachine(machine, {
      input: { value: 1 } // Now input is required at compile time!
    });
    return <></>;
  }
  ```

  This avoids runtime errors when forgetting to pass `input` when defined inside `types`.

## 3.0.3

### Patch Changes

- [#4844](https://github.com/statelyai/xstate/pull/4844) [`5aa6eb05c`](https://github.com/statelyai/xstate/commit/5aa6eb05c4d79a7efda9895b212fdb45a638f31f) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The `useSelector(…)` hook from `@xstate/react` is now compatible with stores from `@xstate/store`.

  ```tsx
  import { createStore } from '@xstate/store';
  import { useSelector } from '@xstate/react';

  const store = createStore(
    {
      count: 0
    },
    {
      inc: {
        count: (context) => context.count + 1
      }
    }
  );

  function Counter() {
    // Note that this `useSelector` is from `@xstate/react`,
    // not `@xstate/store/react`
    const count = useSelector(store, (state) => state.context.count);

    return (
      <div>
        <button onClick={() => store.send({ type: 'inc' })}>{count}</button>
      </div>
    );
  }
  ```

## 3.0.2

### Patch Changes

- [#4600](https://github.com/statelyai/xstate/pull/4600) [`1f2ccb97c`](https://github.com/statelyai/xstate/commit/1f2ccb97ca00ff2d2ec1c9996f8205dbe656602b) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Typegen-based types for detecting missing implementations have been removed internally.

## 3.0.1

### Patch Changes

- [#4591](https://github.com/statelyai/xstate/pull/4591) [`f8cc116d3`](https://github.com/statelyai/xstate/commit/f8cc116d31ead0ffd39db8bbd1b5122702b229a0) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Marked `useMachine` as aliased, not deprecated.

## 3.0.0

### Major Changes

- [#4507](https://github.com/statelyai/xstate/pull/4507) [`9ea542c34`](https://github.com/statelyai/xstate/commit/9ea542c346f7028ca77ae56ce1fe285372fa4cab) Thanks [@Andarist](https://github.com/Andarist)! - The `useMachine(machine)` hook now returns `{ snapshot, send, actorRef }` instead of `{ state, send, service }`:

  ```diff
  const {
  - state,
  + snapshot,
    send,
  - service
  + actorRef
  } = useMachine(machine);
  ```

- [#4265](https://github.com/statelyai/xstate/pull/4265) [`1153b3f9a`](https://github.com/statelyai/xstate/commit/1153b3f9a95b4d76ff5408be8bd03a66f884b9cb) Thanks [@davidkpiano](https://github.com/davidkpiano)! - FSM-related functions have been removed.

### Minor Changes

- [#3727](https://github.com/statelyai/xstate/pull/3727) [`5fb3c683d`](https://github.com/statelyai/xstate/commit/5fb3c683d9a9bdc06637b3a13a5b575059aebadd) Thanks [@Andarist](https://github.com/Andarist)! - `exports` field has been added to the `package.json` manifest. It limits what files can be imported from a package - it's no longer possible to import from files that are not considered to be a part of the public API.
- [#4507](https://github.com/statelyai/xstate/pull/4507) [`9ea542c34`](https://github.com/statelyai/xstate/commit/9ea542c346f7028ca77ae56ce1fe285372fa4cab) Thanks [@Andarist](https://github.com/Andarist)! - The `useActorRef(logic)` and `useActor(logic)` hooks have been added.

## 2.1.0

### Minor Changes

- [#4128](https://github.com/statelyai/xstate/pull/4128) [`bdcc3b0fb`](https://github.com/statelyai/xstate/commit/bdcc3b0fbda3caa76e8bdecc132dffe1d76d959a) Thanks [@jer-0](https://github.com/jer-0)! - Allow Svelte 4 in the specified peer dependency range.

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
