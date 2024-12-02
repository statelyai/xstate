# @xstate/solid

## 1.0.0

### Patch Changes

- Updated dependencies [[`8c4b70652acaef2702f32435362e4755679a516d`](https://github.com/statelyai/xstate/commit/8c4b70652acaef2702f32435362e4755679a516d)]:
  - xstate@5.19.0

## 0.2.3

### Patch Changes

- [#5100](https://github.com/statelyai/xstate/pull/5100) [`519188af785527195eea15972efbb260289c9979`](https://github.com/statelyai/xstate/commit/519188af785527195eea15972efbb260289c9979) Thanks [@GoldingAustin](https://github.com/GoldingAustin)! - When setting new array indexes, if the value is an object/array, use placeholder empty value to prevent mutation of original machine context

## 0.2.2

### Patch Changes

- Updated dependencies [[`25963966c394fc904dc9b701a420b6e204ebe7f7`](https://github.com/statelyai/xstate/commit/25963966c394fc904dc9b701a420b6e204ebe7f7)]:
  - xstate@5.18.2

## 0.2.1

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

## 0.2.0

### Minor Changes

- [#3727](https://github.com/statelyai/xstate/pull/3727) [`5fb3c68`](https://github.com/statelyai/xstate/commit/5fb3c68) Thanks [@Andarist](https://github.com/Andarist)! - `exports` field has been added to the `package.json` manifest. It limits what files can be imported from a package - it's no longer possible to import from files that are not considered to be a part of the public API.

- [#4265](https://github.com/statelyai/xstate/pull/4265) [`1153b3f`](https://github.com/statelyai/xstate/commit/1153b3f) Thanks [@davidkpiano](https://github.com/davidkpiano)! - FSM-related functions have been removed.

- [#4748](https://github.com/statelyai/xstate/pull/4748) [`d73ac8e48`](https://github.com/statelyai/xstate/commit/d73ac8e48af82d4d3bde648206e633eb93193353) Thanks [@Andarist](https://github.com/Andarist)! - The `createService(machine)` hook has been removed; use the `useActorRef(logic)` hook instead.

- [#4748](https://github.com/statelyai/xstate/pull/4748) [`d73ac8e48`](https://github.com/statelyai/xstate/commit/d73ac8e48af82d4d3bde648206e633eb93193353) Thanks [@Andarist](https://github.com/Andarist)! - The `fromActorRef(actorRef)` has been added. You can use it to get an accessor for reactive snapshot of any existing `actorRef`.

- [#4748](https://github.com/statelyai/xstate/pull/4748) [`d73ac8e48`](https://github.com/statelyai/xstate/commit/d73ac8e48af82d4d3bde648206e633eb93193353) Thanks [@Andarist](https://github.com/Andarist)! - The `useActor` hook accepts an actor `logic` now and not an existing `actorRef`. It's used to creating a new instance of an actor and it works just like `useMachine` used to work (`useMachine` is now just an alias of `useActor`).

## 0.1.3

### Patch Changes

- [#3856](https://github.com/statelyai/xstate/pull/3856) [`7e5110b94`](https://github.com/statelyai/xstate/commit/7e5110b9454d50b81cd7089eaeaf84cb14415f43) Thanks [@GoldingAustin](https://github.com/GoldingAustin)! - Fix array deletions/additions causing duplicate entries

## 0.1.2

### Patch Changes

- [#3810](https://github.com/statelyai/xstate/pull/3810) [`3bb4a00e7`](https://github.com/statelyai/xstate/commit/3bb4a00e7e4eb66a3fabfc20e811bbadfa8eb7a4) Thanks [@GoldingAustin](https://github.com/GoldingAustin)! - Fix state.nextEvents being undefined and not updating

## 0.1.1

### Patch Changes

- [#3805](https://github.com/statelyai/xstate/pull/3805) [`4650eb4d5`](https://github.com/statelyai/xstate/commit/4650eb4d533251cd8a9a30c9e89710b486386e3a) Thanks [@GoldingAustin](https://github.com/GoldingAustin)! - Fixed an issue with npm lifecycle scripts that caused only a single set of files to be published.
