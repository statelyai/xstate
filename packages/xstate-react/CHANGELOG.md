# Changelog

## 6.1.0

### Minor Changes

- [#5470](https://github.com/statelyai/xstate/pull/5470) [`3e03427`](https://github.com/statelyai/xstate/commit/3e03427639154a021c85e99e0518ab92cc42dc6d) Thanks [@davidkpiano](https://github.com/davidkpiano)! - `useActor` and `useSelector` now throw when the actor reaches an error state, allowing errors to be caught by React error boundaries.

  ```tsx
  import { createMachine } from 'xstate';
  import { useActor } from '@xstate/react';
  import { ErrorBoundary } from 'react-error-boundary';

  const machine = createMachine({
    initial: 'idle',
    states: {
      idle: {
        on: {
          fetch: 'loading'
        }
      },
      loading: {
        invoke: {
          src: fromPromise(async () => {
            throw new Error('Network error');
          }),
          onDone: 'success'
          // Without onError, the actor enters an error state
        }
      },
      success: {}
    }
  });

  function App() {
    return (
      <ErrorBoundary fallback={<p>Something went wrong</p>}>
        <ActorComponent />
      </ErrorBoundary>
    );
  }

  function ActorComponent() {
    // If the actor errors, the error will be thrown
    // and caught by the nearest error boundary
    const [snapshot, send] = useActor(machine);

    return <div>{snapshot.value}</div>;
  }
  ```

## 6.0.0

### Patch Changes

- Updated dependencies [[`e07a7cd8462473188a0fb646a965e61be1ce6ae3`](https://github.com/statelyai/xstate/commit/e07a7cd8462473188a0fb646a965e61be1ce6ae3)]:
  - xstate@5.20.0

## 5.0.5

### Patch Changes

- Updated dependencies [[`479c74b83fa77c57c48f54cf0e9dcfab5fe6cae5`](https://github.com/statelyai/xstate/commit/479c74b83fa77c57c48f54cf0e9dcfab5fe6cae5)]:
  - xstate@5.19.4

## 5.0.4

### Patch Changes

- Updated dependencies [[`b453b2d72ba12d0fe46a995f9ccced8000fd0cc9`](https://github.com/statelyai/xstate/commit/b453b2d72ba12d0fe46a995f9ccced8000fd0cc9)]:
  - xstate@5.19.3

## 5.0.3

### Patch Changes

- [#5223](https://github.com/statelyai/xstate/pull/5223) [`9e1de554c4ebf49997b717fada540951d01f511c`](https://github.com/statelyai/xstate/commit/9e1de554c4ebf49997b717fada540951d01f511c) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Added React 19 as a peer dependency.

## 5.0.2

### Patch Changes

- Updated dependencies [[`d99df1d8f4fe49145c9974465b65028bf19b365f`](https://github.com/statelyai/xstate/commit/d99df1d8f4fe49145c9974465b65028bf19b365f)]:
  - xstate@5.19.2

## 5.0.1

### Patch Changes

- Updated dependencies [[`bf6119a7310a878afbf4f5b01f5e24288f9a0f16`](https://github.com/statelyai/xstate/commit/bf6119a7310a878afbf4f5b01f5e24288f9a0f16)]:
  - xstate@5.19.1

## 5.0.0

### Patch Changes

- [#5109](https://github.com/statelyai/xstate/pull/5109) [`d67b71dd25d457a2a59f2c943db13f50fab7ec3d`](https://github.com/statelyai/xstate/commit/d67b71dd25d457a2a59f2c943db13f50fab7ec3d) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Add React 19 as a peer dependency

- Updated dependencies [[`8c4b70652acaef2702f32435362e4755679a516d`](https://github.com/statelyai/xstate/commit/8c4b70652acaef2702f32435362e4755679a516d)]:
  - xstate@5.19.0

## 4.1.3

### Patch Changes

- Updated dependencies [[`25963966c394fc904dc9b701a420b6e204ebe7f7`](https://github.com/statelyai/xstate/commit/25963966c394fc904dc9b701a420b6e204ebe7f7)]:
  - xstate@5.18.2

## 4.1.2

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

## 4.1.1

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

## 4.1.0

### Minor Changes

- [#4231](https://github.com/statelyai/xstate/pull/4231) [`c2402e7bc`](https://github.com/statelyai/xstate/commit/c2402e7bc269dd1f1a9eca0d3e4484ad5a4cfadb) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The `actor` passed to `useSelector(actor, selector)` is now allowed to be `undefined` for an actor that may not exist yet. For actors that may be `undefined`, the `snapshot` provided to the `selector` function can also be `undefined`:

  ```ts
  const count = useSelector(maybeActor, (snapshot) => {
    // `snapshot` may be undefined
    return snapshot?.context.count;
  });

  count; // number | undefined
  ```

## 4.0.3

### Patch Changes

- [#4695](https://github.com/statelyai/xstate/pull/4695) [`52900a084`](https://github.com/statelyai/xstate/commit/52900a084712755b00e6c38eb9aa2c3b290259b5) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Options in `createActorContext` are now properly merged with provider options. Previously, provider options replaced the actor options.

  ```tsx
  const { inspect } = createBrowserInspector();

  const SomeContext = createActorContext(someMachine, { inspect });

  // ...
  // Options are now merged:
  // { inspect: inspect, input: 10 }
  <SomeContext.Provider options={{ input: 10 }}>
    {/* ... */}
  </SomeContext.Provider>;
  ```

## 4.0.2

### Patch Changes

- [#4600](https://github.com/statelyai/xstate/pull/4600) [`1f2ccb97c`](https://github.com/statelyai/xstate/commit/1f2ccb97ca00ff2d2ec1c9996f8205dbe656602b) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Typegen-based types for detecting missing implementations have been removed internally.

## 4.0.1

### Patch Changes

- [#4497](https://github.com/statelyai/xstate/pull/4497) [`d7f220225`](https://github.com/statelyai/xstate/commit/d7f220225c34808a96383099e1f9bfd3abd13962) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Fix an issue where `after` transitions do not work in React strict mode. Delayed events (including from `after` transitions) should now work as expected in all React modes.

## 4.0.0

### Major Changes

- [#3947](https://github.com/statelyai/xstate/pull/3947) [`5fa3a0c74`](https://github.com/statelyai/xstate/commit/5fa3a0c74343e400871473d375f02d3d918d1f4e) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Removed the ability to pass a factory function as argument to `useMachine`.
- [#4006](https://github.com/statelyai/xstate/pull/4006) [`42df9a536`](https://github.com/statelyai/xstate/commit/42df9a5360ec776ca3ce8bcd0f90873a79125bf2) Thanks [@davidkpiano](https://github.com/davidkpiano)! - `useActorRef` is introduced, which returns an `ActorRef` from actor logic:

  ```ts
  const actorRef = useActorRef(machine, { ... });
  const anotherActorRef = useActorRef(fromPromise(...));
  ```

  ~~`useMachine`~~ is deprecated in favor of `useActor`, which works with machines and any other kind of logic

  ```diff
  -const [state, send] = useMachine(machine);
  +const [state, send] = useActor(machine);
  const [state, send] = useActor(fromTransition(...));
  ```

  ~~`useSpawn`~~ is removed in favor of `useActorRef`

  ````diff
  -const actorRef = useSpawn(machine);
  +const actorRef = useActorRef(machine);

  The previous use of `useActor(actorRef)` is now replaced with just using the `actorRef` directly, and with `useSelector`:

  ```diff
  -const [state, send] = useActor(actorRef);
  +const state = useSelector(actorRef, s => s);
  // actorRef.send(...)
  ````

- [#4050](https://github.com/statelyai/xstate/pull/4050) [`fc88dc8e6`](https://github.com/statelyai/xstate/commit/fc88dc8e6d3fbc4ee8a1e0bdb538bab560b7a695) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The `options` prop has been added (back) to the `Context.Provider` component returned from `createActorContext`:

  ```tsx
  const SomeContext = createActorContext(someMachine);

  // ...

  <SomeContext.Provider options={{ input: 42 }}>
    {/* ... */}
  </SomeContext.Provider>;
  ```

- [#4006](https://github.com/statelyai/xstate/pull/4006) [`42df9a536`](https://github.com/statelyai/xstate/commit/42df9a5360ec776ca3ce8bcd0f90873a79125bf2) Thanks [@davidkpiano](https://github.com/davidkpiano)! - `useActor` has been removed from the created actor context, you should be able to replace its usage with `MyCtx.useSelector` and `MyCtx.useActorRef`.
- [#4265](https://github.com/statelyai/xstate/pull/4265) [`1153b3f9a`](https://github.com/statelyai/xstate/commit/1153b3f9a95b4d76ff5408be8bd03a66f884b9cb) Thanks [@davidkpiano](https://github.com/davidkpiano)! - FSM-related functions have been removed.
- [#3947](https://github.com/statelyai/xstate/pull/3947) [`5fa3a0c74`](https://github.com/statelyai/xstate/commit/5fa3a0c74343e400871473d375f02d3d918d1f4e) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Implementations for machines on `useMachine` hooks should go directly on the machine via `machine.provide(...)`, and are no longer allowed to be passed in as options.

  ```diff
  -const [state, send] = useMachine(machine, {
  -  actions: {
  -    // ...
  -  }
  -});
  +const [state, send] = useMachine(machine.provide({
  +  actions: {
  +    // ...
  +  }
  +}));
  ```

- [#3148](https://github.com/statelyai/xstate/pull/3148) [`7a68cbb61`](https://github.com/statelyai/xstate/commit/7a68cbb615afb6556c83868535dae67af366a117) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Removed `getSnapshot` parameter from hooks. It is expected that the received `actorRef` has to have a `getSnapshot` method on it that can be used internally.

### Minor Changes

- [#3727](https://github.com/statelyai/xstate/pull/3727) [`5fb3c683d`](https://github.com/statelyai/xstate/commit/5fb3c683d9a9bdc06637b3a13a5b575059aebadd) Thanks [@Andarist](https://github.com/Andarist)! - `exports` field has been added to the `package.json` manifest. It limits what files can be imported from a package - it's no longer possible to import from files that are not considered to be a part of the public API.
- [#4240](https://github.com/statelyai/xstate/pull/4240) [`409552cf8`](https://github.com/statelyai/xstate/commit/409552cf8578dc517cca4e6eaeb652a33f49c06c) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The `useMachine` function is an alias of `useActor`.
- [#4436](https://github.com/statelyai/xstate/pull/4436) [`340aee643`](https://github.com/statelyai/xstate/commit/340aee6437767fa3dc5cef6e991cf975fe27467a) Thanks [@Andarist](https://github.com/Andarist)! - Fast refresh now works as expected for most use-cases.
- [#4050](https://github.com/statelyai/xstate/pull/4050) [`fc88dc8e6`](https://github.com/statelyai/xstate/commit/fc88dc8e6d3fbc4ee8a1e0bdb538bab560b7a695) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The `observerOrListener` argument has been removed from the 3rd argument of `createActorContext(logic, options)`.

## 4.0.0-beta.11

### Minor Changes

- [#4436](https://github.com/statelyai/xstate/pull/4436) [`340aee643`](https://github.com/statelyai/xstate/commit/340aee6437767fa3dc5cef6e991cf975fe27467a) Thanks [@Andarist](https://github.com/Andarist)! - Fast refresh now works as expected for most use-cases.

## 4.0.0-beta.10

### Minor Changes

- [#4240](https://github.com/statelyai/xstate/pull/4240) [`409552cf8`](https://github.com/statelyai/xstate/commit/409552cf8578dc517cca4e6eaeb652a33f49c06c) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The `useMachine` function is aliased to `useActor` and not shown as visually deprecated.

## 4.0.0-beta.9

### Major Changes

- [#4265](https://github.com/statelyai/xstate/pull/4265) [`1153b3f9a`](https://github.com/statelyai/xstate/commit/1153b3f9a95b4d76ff5408be8bd03a66f884b9cb) Thanks [@davidkpiano](https://github.com/davidkpiano)! - FSM-related functions have been removed.

## 4.0.0-beta.8

### Patch Changes

- [#4138](https://github.com/statelyai/xstate/pull/4138) [`461e3983a`](https://github.com/statelyai/xstate/commit/461e3983a0e9d51c43a4b0e7370354b7dea24e5f) Thanks [@Andarist](https://github.com/Andarist)! - Fixed missing `.mjs` proxy files for condition-based builds.

## 4.0.0-beta.7

### Major Changes

- [#4050](https://github.com/statelyai/xstate/pull/4050) [`fc88dc8e6`](https://github.com/statelyai/xstate/commit/fc88dc8e6d3fbc4ee8a1e0bdb538bab560b7a695) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The `options` prop has been added (back) to the `Context.Provider` component returned from `createActorContext`:

  ```tsx
  const SomeContext = createActorContext(someMachine);

  // ...

  <SomeContext.Provider options={{ input: 42 }}>
    {/* ... */}
  </SomeContext.Provider>;
  ```

### Minor Changes

- [#4050](https://github.com/statelyai/xstate/pull/4050) [`fc88dc8e6`](https://github.com/statelyai/xstate/commit/fc88dc8e6d3fbc4ee8a1e0bdb538bab560b7a695) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The `observerOrListener` argument has been removed from the 3rd argument of `createActorContext(logic, options)`.

## 4.0.0-beta.6

### Major Changes

- [#4041](https://github.com/statelyai/xstate/pull/4041) [`50fe8cdd4`](https://github.com/statelyai/xstate/commit/50fe8cdd4114e77c104520f9c89d471cf2173dfb) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Instances of "behavior" in the codebase have been replaced with "actor logic".

## 4.0.0-beta.5

### Patch Changes

- [#4033](https://github.com/statelyai/xstate/pull/4033) [`9cb7cb51a`](https://github.com/statelyai/xstate/commit/9cb7cb51a0ce577d2de508aedf3773d4f80f9d46) Thanks [@Andarist](https://github.com/Andarist)! - Fixed generated TS declaration files to not include `.ts` extensions in the import/export statements.

## 4.0.0-beta.4

### Major Changes

- [#3947](https://github.com/statelyai/xstate/pull/3947) [`5fa3a0c74`](https://github.com/statelyai/xstate/commit/5fa3a0c74343e400871473d375f02d3d918d1f4e) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Removed the ability to pass a factory function as argument to `useMachine` and `useInterpret`.

- [#4006](https://github.com/statelyai/xstate/pull/4006) [`42df9a536`](https://github.com/statelyai/xstate/commit/42df9a5360ec776ca3ce8bcd0f90873a79125bf2) Thanks [@davidkpiano](https://github.com/davidkpiano)! - `useActorRef` is introduced, which returns an `ActorRef` from actor logic:

  ```ts
  const actorRef = useActorRef(machine, { ... });
  const anotherActorRef = useActorRef(fromPromise(...));
  ```

  ~~`useMachine`~~ is deprecated in favor of `useActor`, which works with machines and any other kind of logic

  ```diff
  -const [state, send] = useMachine(machine);
  +const [state, send] = useActor(machine);
  const [state, send] = useActor(fromTransition(...));
  ```

  ~~`useSpawn`~~ is removed in favor of `useActorRef`

  ````diff
  -const actorRef = useSpawn(machine);
  +const actorRef = useActorRef(machine);

  The previous use of `useActor(actorRef)` is now replaced with just using the `actorRef` directly, and with `useSelector`:

  ```diff
  -const [state, send] = useActor(actorRef);
  +const state = useSelector(actorRef, s => s);
  // actorRef.send(...)
  ````

- [#4006](https://github.com/statelyai/xstate/pull/4006) [`42df9a536`](https://github.com/statelyai/xstate/commit/42df9a5360ec776ca3ce8bcd0f90873a79125bf2) Thanks [@davidkpiano](https://github.com/davidkpiano)! - `useActor` has been removed from the created actor context, you should be able to replace its usage with `MyCtx.useSelector` and `MyCtx.useActorRef`.

- [#3947](https://github.com/statelyai/xstate/pull/3947) [`5fa3a0c74`](https://github.com/statelyai/xstate/commit/5fa3a0c74343e400871473d375f02d3d918d1f4e) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Implementations for machines on `useMachine` and `useInterpret` hooks should go directly on the machine via `machine.provide(...)`, and are no longer allowed to be passed in as options.

  ```diff
  -const [state, send] = useMachine(machine, {
  -  actions: {
  -    // ...
  -  }
  -});
  +const [state, send] = useMachine(machine.provide({
  +  actions: {
  +    // ...
  +  }
  +}));
  ```

  `@xstate/react` will detect that the machine's config is still the same, and will not produce the "machine has changed" warning.

## 3.2.2

### Patch Changes

- [#3919](https://github.com/statelyai/xstate/pull/3919) [`6665f0a32`](https://github.com/statelyai/xstate/commit/6665f0a32327407e8fec12240383f211094d929c) Thanks [@c-w](https://github.com/c-w)! - Updated the allowed range for the `use-isomorphic-layout-effect` dependency.

## 4.0.0-beta.3

## 4.0.0-alpha.2

### Patch Changes

- [#3944](https://github.com/statelyai/xstate/pull/3944) [`305a89001`](https://github.com/statelyai/xstate/commit/305a89001d229f43eb85cd7bd06e797c3fb4f78a) Thanks [@Andarist](https://github.com/Andarist)! - Releasing adjusted internals to make the alpha version of this module compatible with the current version of `xstate@alpha`

## 3.2.1

### Patch Changes

- [#3829](https://github.com/statelyai/xstate/pull/3829) [`c110c429d`](https://github.com/statelyai/xstate/commit/c110c429d33cb724242ff65136de3ebe408eab97) Thanks [@Andarist](https://github.com/Andarist)! - Fixed compatibility of the generated TS types for `createActorContext` with pre-4.7.

## 3.2.0

### Minor Changes

- [#3814](https://github.com/statelyai/xstate/pull/3814) [`494203b3d`](https://github.com/statelyai/xstate/commit/494203b3dc358807e96cf1368f1347ff8e1d14e3) Thanks [@Andarist](https://github.com/Andarist)! - The `Provider` from `createActorContext(...)` now accepts the `options={{...}}` prop that takes the same object as the second argument to the `useMachine(machine, options)` hook.

  These options are no longer passed as the second argument to the `createActorContext(machine)` function:

  ```diff

  -const SomeContext = createActorContext(someMachine,
  -  { actions: { ... } });
  +const SomeContext = createActorContext(someMachine);

  // ...

  -<SomeContext.Provider>
  +<SomeContext.Provider options={{ actions: { ... } }}>

  // ...
  ```

## 3.1.2

### Patch Changes

- [#3804](https://github.com/statelyai/xstate/pull/3804) [`b53856d28`](https://github.com/statelyai/xstate/commit/b53856d28da4ecbba7d4393f72aa38894fd523d9) Thanks [@farskid](https://github.com/farskid)! - Interpreter options can now be specified in the second argument of createActorContext(machine, options).

## 3.1.1

### Patch Changes

- [#3799](https://github.com/statelyai/xstate/pull/3799) [`51d254692`](https://github.com/statelyai/xstate/commit/51d254692c2d267c24c65fc5802461540c012393) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an issue that caused the internally used `useSyncExternalStore` to warn about the computed snapshot not being cached when a not-started machine service was passed to `useActor`.

## 3.1.0

### Minor Changes

- [#3778](https://github.com/statelyai/xstate/pull/3778) [`f12248b23`](https://github.com/statelyai/xstate/commit/f12248b2379e4e554d69a238019216feea5211f6) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The `createActorContext(...)` helper has been introduced to make global actors easier to use with React. It outputs a React Context object with the following properties:
  - `.Provider` - The React Context provider
  - `.useActor(...)` - A hook that can be used to get the current state and send events to the actor
  - `.useSelector(...)` - A hook that can be used to select some derived state from the actor's state
  - `.useActorRef()` - A hook that can be used to get a reference to the actor that can be passed to other components

  Usage:

  ```jsx
  import { createActorContext } from '@xstate/react';
  import { someMachine } from './someMachine';

  // Create a React Context object that will interpret the machine
  const SomeContext = createActorContext(someMachine);

  function SomeComponent() {
    // Get the current state and `send` function
    const [state, send] = SomeContext.useActor();

    // Or select some derived state
    const someValue = SomeContext.useSelector((state) => state.context.someValue);

    // Or get a reference to the actor
    const actorRef = SomeContext.useActorRef();

    return (/* ... */);
  }

  function App() {
    return (
      <SomeContext.Provider>
        <SomeComponent />
      </SomeContext.Provider>
    );
  }
  ```

## 3.0.2

### Patch Changes

- [#3752](https://github.com/statelyai/xstate/pull/3752) [`4190c3fd6`](https://github.com/statelyai/xstate/commit/4190c3fd6d9bb6e7fca5c01cc1722f40e7e63399) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Computing the initial state is now consistent with `useMachine` and `useActor`, avoiding stale initial state problems with nested machines

## 4.0.0-alpha.1

### Minor Changes

- [#3727](https://github.com/statelyai/xstate/pull/3727) [`5fb3c683d`](https://github.com/statelyai/xstate/commit/5fb3c683d9a9bdc06637b3a13a5b575059aebadd) Thanks [@Andarist](https://github.com/Andarist)! - `exports` field has been added to the `package.json` manifest. It limits what files can be imported from a package - it's no longer possible to import from files that are not considered to be a part of the public API.

### Patch Changes

- Updated dependencies [[`5fb3c683d`](https://github.com/statelyai/xstate/commit/5fb3c683d9a9bdc06637b3a13a5b575059aebadd), [`ec39214c8`](https://github.com/statelyai/xstate/commit/ec39214c8eba11d75f6af72bae51ddb65ce003a0)]:
  - @xstate/fsm@3.0.0-alpha.0

## 3.0.1

### Patch Changes

- [#3456](https://github.com/statelyai/xstate/pull/3456) [`131d429ab`](https://github.com/statelyai/xstate/commit/131d429ab350aaca371c4c7974829c621a50c024) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Add `shallowEqual` helper comparator function.

- [#3500](https://github.com/statelyai/xstate/pull/3500) [`0dfc6d92f`](https://github.com/statelyai/xstate/commit/0dfc6d92f6950b3eb78e0693ae3b0abe5751bf42) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an issue with `useSelector` always computing fresh snapshots internally for uninitialized services. This avoids the internal `useSyncExternalStore` from warning about the snapshot value not being cached properly.

## 4.0.0-alpha.0

### Major Changes

- [#3148](https://github.com/statelyai/xstate/pull/3148) [`7a68cbb61`](https://github.com/statelyai/xstate/commit/7a68cbb615afb6556c83868535dae67af366a117) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Removed `getSnapshot` parameter from hooks. It is expected that the received `actorRef` has to have a `getSnapshot` method on it that can be used internally.

### Patch Changes

- Updated dependencies [[`7f3b84816`](https://github.com/statelyai/xstate/commit/7f3b84816564d951b6b29afdd7075256f1f59501), [`969a2f4fc`](https://github.com/statelyai/xstate/commit/969a2f4fc0bc9147b9a52da25306e5c13b97f159), [`c0a6dcafa`](https://github.com/statelyai/xstate/commit/c0a6dcafa1a11a5ff1660b57e0728675f155c292), [`7a68cbb61`](https://github.com/statelyai/xstate/commit/7a68cbb615afb6556c83868535dae67af366a117), [`172d6a7e1`](https://github.com/statelyai/xstate/commit/172d6a7e1e4ab0fa73485f76c52675be8a1f3362), [`31bc73e05`](https://github.com/statelyai/xstate/commit/31bc73e05692f29301f5bb5cb4b87b90773e0ef2), [`e09efc720`](https://github.com/statelyai/xstate/commit/e09efc720f05246b692d0fdf17cf5d8ac0344ee6), [`145539c4c`](https://github.com/statelyai/xstate/commit/145539c4cfe1bde5aac247792622428e44342dd6), [`3de36bb24`](https://github.com/statelyai/xstate/commit/3de36bb24e8f59f54d571bf587407b1b6a9856e0), [`9e10660ec`](https://github.com/statelyai/xstate/commit/9e10660ec2f1e89cbb09a1094edb4f6b8a273a99), [`8fcbddd51`](https://github.com/statelyai/xstate/commit/8fcbddd51d66716ab1d326d934566a7664a4e175), [`515cdc9c1`](https://github.com/statelyai/xstate/commit/515cdc9c148a3a1b558120c309080e9a21e876bc), [`6043a1c28`](https://github.com/statelyai/xstate/commit/6043a1c28d21ff8cbabc420a6817a02a1a54fcc8), [`6a6b2b869`](https://github.com/statelyai/xstate/commit/6a6b2b8691626112d1d9dbf23d0a0e80ff7130a8), [`0b49437b1`](https://github.com/statelyai/xstate/commit/0b49437b1be3e6d9bc61304711b83300cba88dc4), [`0e24ea6d6`](https://github.com/statelyai/xstate/commit/0e24ea6d62a5c1a8b7e365f2252dc930d94997c4), [`04e89f90f`](https://github.com/statelyai/xstate/commit/04e89f90f97fe25a45b5908c45f25a513f0fd70f), [`0096d9f7a`](https://github.com/statelyai/xstate/commit/0096d9f7afda7546fc7b1d5fdd1546f55c32bfe4), [`8fcbddd51`](https://github.com/statelyai/xstate/commit/8fcbddd51d66716ab1d326d934566a7664a4e175), [`b200e0e0b`](https://github.com/statelyai/xstate/commit/b200e0e0b7123797086080b75abdfcf2fce45253), [`7a68cbb61`](https://github.com/statelyai/xstate/commit/7a68cbb615afb6556c83868535dae67af366a117), [`9437c3de9`](https://github.com/statelyai/xstate/commit/9437c3de912c2a38c04798cbb94f267a1e5db3f8), [`0038c7b1e`](https://github.com/statelyai/xstate/commit/0038c7b1e2050fe7262849aab8fdff4a7ce7cf92), [`7a68cbb61`](https://github.com/statelyai/xstate/commit/7a68cbb615afb6556c83868535dae67af366a117), [`b24e47b9e`](https://github.com/statelyai/xstate/commit/b24e47b9e7a59a5b0527d4386cea3af16c84ca7a), [`390eaaa52`](https://github.com/statelyai/xstate/commit/390eaaa523cb0dd243e39c6300e671606c1e45fc), [`7a68cbb61`](https://github.com/statelyai/xstate/commit/7a68cbb615afb6556c83868535dae67af366a117), [`0c6cfee9a`](https://github.com/statelyai/xstate/commit/0c6cfee9a6d603aa1756e3a6d0f76d4da1486caf), [`e09efc720`](https://github.com/statelyai/xstate/commit/e09efc720f05246b692d0fdf17cf5d8ac0344ee6), [`025a2d6a2`](https://github.com/statelyai/xstate/commit/025a2d6a295359a746bee6ffc2953ccc51a6aaad), [`e09efc720`](https://github.com/statelyai/xstate/commit/e09efc720f05246b692d0fdf17cf5d8ac0344ee6), [`c99bb43af`](https://github.com/statelyai/xstate/commit/c99bb43afec01ddee86fc746c346ea1aeeca687d), [`fc5ca7b7f`](https://github.com/statelyai/xstate/commit/fc5ca7b7fcd2d7821ce2409743c50505529104e7), [`c9cda27cb`](https://github.com/statelyai/xstate/commit/c9cda27cbe52b9c706ccb63b709d22d049be31e3), [`5d16a7365`](https://github.com/statelyai/xstate/commit/5d16a73651e97dd0228c5215cb2452a4d9951118), [`8fcbddd51`](https://github.com/statelyai/xstate/commit/8fcbddd51d66716ab1d326d934566a7664a4e175), [`53a594e9a`](https://github.com/statelyai/xstate/commit/53a594e9a1b49ccb1121048a5784676f83950024), [`31a0d890f`](https://github.com/statelyai/xstate/commit/31a0d890f55d8f0b06772c9fd510b18302b76ebb)]:
  - xstate@5.0.0-alpha.0

## 3.0.0

### Major Changes

- [#2939](https://github.com/statelyai/xstate/pull/2939) [`360e85462`](https://github.com/statelyai/xstate/commit/360e8546298c4a06b6d51d8f12c0563672dd7acf) Thanks [@Andarist](https://github.com/Andarist)! - This package now accepts React 18 as a peer dep and the implementation has been rewritten to use [`use-sync-external-store`](https://www.npmjs.com/package/use-sync-external-store) package. This doesn't break compatibility with older versions of React since we are using the shim to keep compatibility with those older versions.

- [#2939](https://github.com/statelyai/xstate/pull/2939) [`360e85462`](https://github.com/statelyai/xstate/commit/360e8546298c4a06b6d51d8f12c0563672dd7acf) Thanks [@Andarist](https://github.com/Andarist)! - `asEffect` and `asLayoutEffect` action creators were removed. They were not fitting the React model that well and could lead to issues as their existence suggested that they are easy to use.

  To execute actions at those exact times you can always either just call your stuff directly from those effects or send events to the machine from those effects and execute explicit actions in response to said events.

- [#2939](https://github.com/statelyai/xstate/pull/2939) [`360e85462`](https://github.com/statelyai/xstate/commit/360e8546298c4a06b6d51d8f12c0563672dd7acf) Thanks [@Andarist](https://github.com/Andarist)! - The signatures of `useMachine` and `useService` integrating with `@xstate/fsm` were changed. They now only accept a single generic each (`TMachine` and `TService` respectively). This has been done to match their signatures with the related hooks that integrate with `xstate` itself.

### Patch Changes

- [#2939](https://github.com/statelyai/xstate/pull/2939) [`360e85462`](https://github.com/statelyai/xstate/commit/360e8546298c4a06b6d51d8f12c0563672dd7acf) Thanks [@Andarist](https://github.com/Andarist)! - In v2 we have changed signatures of `useMachine` and `useInterpret`. Instead of accepting a list of generics they now only support a single generic: `TMachine`. This change, erroneously, was only introduced to types targeting TS@4.x but the types targeting previous TS releases were still using the older signatures. This has now been fixed and users of older TS versions should now be able to leverage typegen with `@xstate/react`.

- [#2939](https://github.com/statelyai/xstate/pull/2939) [`360e85462`](https://github.com/statelyai/xstate/commit/360e8546298c4a06b6d51d8f12c0563672dd7acf) Thanks [@Andarist](https://github.com/Andarist)! - `useMachine` for `xstate` now correctly rerenders with the initial state when the internal service is being restarted. This might happen during Fast Refresh and now you shouldn't be able to observe this stale state that didn't match the actual state of the service.

- [#2939](https://github.com/statelyai/xstate/pull/2939) [`360e85462`](https://github.com/statelyai/xstate/commit/360e8546298c4a06b6d51d8f12c0563672dd7acf) Thanks [@Andarist](https://github.com/Andarist)! - `useMachine` for `@xstate/fsm` now starts the service in an effect. This avoids side-effects in render and improves the compatibility with `StrictMode`.

- [#2939](https://github.com/statelyai/xstate/pull/2939) [`360e85462`](https://github.com/statelyai/xstate/commit/360e8546298c4a06b6d51d8f12c0563672dd7acf) Thanks [@Andarist](https://github.com/Andarist)! - Implementations given to `useMachine` targeting `@xstate/fsm` are now updated in a layout effect. This avoid some stale closure problems for actions that are executed in response to events sent from layout effects.

* Updated dependencies [[`360e85462`](https://github.com/statelyai/xstate/commit/360e8546298c4a06b6d51d8f12c0563672dd7acf), [`360e85462`](https://github.com/statelyai/xstate/commit/360e8546298c4a06b6d51d8f12c0563672dd7acf)]:
  - @xstate/fsm@2.0.0

## 2.0.1

### Patch Changes

- [#3089](https://github.com/statelyai/xstate/pull/3089) [`862697e29`](https://github.com/statelyai/xstate/commit/862697e2990934d46050580d7e09c749d09d8426) Thanks [@Andarist](https://github.com/Andarist)! - Fixed compatibility with Skypack by exporting some shared utilities from root entry of XState and consuming them directly in other packages (this avoids accessing those things using deep imports and thus it avoids creating those compatibility problems).

## 2.0.0

### Major Changes

- [#2674](https://github.com/statelyai/xstate/pull/2674) [`e5a8b8dff`](https://github.com/statelyai/xstate/commit/e5a8b8dffb88cffbdca26683099ffdf5f1b01c8d) Thanks [@Andarist](https://github.com/Andarist), [@mattpocock](https://github.com/mattpocock)! - To avoid breaking any consumers and to leverage the newly introduced typegen support, the major version of this package had to be bumped. While you can still use it with older versions of TS, the typegen support in this package requires TS version 4.0 or greater.

  When using hooks from `@xstate/react` it's recommended to skip providing explicit generics to them. Note that that generics list has changed since v1 and we now only accept a single generic, `TMachine`.

- [#2674](https://github.com/statelyai/xstate/pull/2674) [`ab919d300`](https://github.com/statelyai/xstate/commit/ab919d300f6d2b78871d3399ec58a697c4268d9b) Thanks [@Andarist](https://github.com/Andarist)! - Removed already deprecated `useService` from `@xstate/react`. You can replace its usage with `useActor`.

### Patch Changes

- [#2957](https://github.com/statelyai/xstate/pull/2957) [`8550ddda7`](https://github.com/statelyai/xstate/commit/8550ddda73e2ad291e19173d7fa8d13e3336fbb9) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The repository links have been updated from `github.com/davidkpiano` to `github.com/statelyai`.

## 1.6.3

### Patch Changes

- [#2767](https://github.com/statelyai/xstate/pull/2767) [`c1503b121`](https://github.com/statelyai/xstate/commit/c1503b1219d995ebf0f45de46036c5a1d7e6442f) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an over-rendering issue in the `useSelector`.

## 1.6.2

### Patch Changes

- [#2736](https://github.com/statelyai/xstate/pull/2736) [`2246ae051`](https://github.com/statelyai/xstate/commit/2246ae051663f261b4750d7adba57f008ec28f1d) Thanks [@Andarist](https://github.com/Andarist), [@davidkpiano](https://github.com/statelyai), [@VanTanev](https://github.com/VanTanev)! - The `useSelector(...)` hook now works as expected when the `actor` passed in changes. The hook will properly subscribe to the new `actor` and select the desired value. See [#2702](https://github.com/statelyai/xstate/issues/2702)

- [#2685](https://github.com/statelyai/xstate/pull/2685) [`469268d39`](https://github.com/statelyai/xstate/commit/469268d39fbc23996599773adfc4ca824b48585f) Thanks [@farskid](https://github.com/farskid), [@Andarist](https://github.com/Andarist)! - Fixed a regression with a development-only warning not being shown when a machine reference is updated during the hook lifecycle. This usually happens when machine options are dependent on external values and they're passed via `withConfig`.

  ```js
  const machine = createMachine({
    initial: 'foo',
    context: { id: 1 },
    states: {
      foo: {
        on: {
          CHECK: {
            target: 'bar',
            cond: 'hasOverflown'
          }
        }
      },
      bar: {}
    }
  });

  const [id, setId] = useState(1);
  const [current, send] = useMachine(
    machine.withConfig({
      guards: {
        hasOverflown: () => id > 1 // id is a reference to an outside value
      }
    })
  );

  // later when id updates
  setId(2);
  // Now the reference passed to `useMachine` (the result of `machine.withConfig`) is updated but the interpreted machine stays the same. So the guard is still the previous one that got passed to the `useMachine` initially, and it closes over the stale `id`.
  ```

## 1.6.1

### Patch Changes

- [#2587](https://github.com/statelyai/xstate/pull/2587) [`5aaa8445c`](https://github.com/statelyai/xstate/commit/5aaa8445c0041c6e9c47285c18e8b71cb2d805a7) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an issue with implementations provided outside of React being wiped out and unusable.

## 1.6.0

### Minor Changes

- [`4b4872ca`](https://github.com/statelyai/xstate/commit/4b4872cafd63f825f3918c6eb6fa84642d45e3e0) [#2241](https://github.com/statelyai/xstate/pull/2241) Thanks [@mattpocock](https://github.com/mattpocock)! - Changed the behaviour of guards, delays and activities when declared as options in `useMachine`/`useInterpret`.

  Previously, guards could not reference external props, because they would not be updated when the props changed. For instance:

  ```tsx
  const Modal = (props) => {
    useMachine(modalMachine, {
      guards: {
        isModalOpen: () => props.isOpen
      }
    });
  };
  ```

  When the component is created, `props.isOpen` would be checked and evaluated to the initial value. But if the guard is evaluated at any other time, it will not respond to the props' changed value.

  This is not true of actions/services. This will work as expected:

  ```tsx
  const Modal = (props) => {
    useMachine(modalMachine, {
      actions: {
        consoleLogModalOpen: () => {
          console.log(props.isOpen);
        }
      }
    });
  };
  ```

  This change brings guards and delays into line with actions and services.

  ⚠️ **NOTE:** Whenever possible, use data from within `context` rather than external data in your guards and delays.

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

## 1.5.1

### Patch Changes

- [`453acacb`](https://github.com/statelyai/xstate/commit/453acacbec364531a2851f183c3ab446d7db0e84) [#2389](https://github.com/statelyai/xstate/pull/2389) Thanks [@davidkpiano](https://github.com/statelyai)! - An internal issue where the `spawnBehavior` import for the `useSpawn(...)` hook was broken internally has been fixed.

## 1.5.0

### Minor Changes

- [`432b60f7`](https://github.com/statelyai/xstate/commit/432b60f7bcbcee9510e0d86311abbfd75b1a674e) [#2280](https://github.com/statelyai/xstate/pull/2280) Thanks [@davidkpiano](https://github.com/statelyai)! - Just like `useInvoke(...)`, other types of actors can now be spawned from _behaviors_ using `useSpawn(...)`:

  ```tsx
  import { fromReducer } from 'xstate/lib/behaviors';
  import { useActor, useSpawn } from '@xstate/react';

  type CountEvent = { type: 'INC' } | { type: 'DEC' };

  const countBehavior = fromReducer(
    (count: number, event: CountEvent): number => {
      if (event.type === 'INC') {
        return count + 1;
      } else if (event.type === 'DEC') {
        return count - 1;
      }

      return count;
    },
    0 // initial state
  );

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

  const Component = () => {
    const countActorRef = useSpawn(countBehavior);
    const [count, send] = useActor(countActorRef);

    return (
      <div>
        Count: {count}
        <button onClick={() => send({ type: 'INC' })}>Increment</button>
        <button onClick={() => send({ type: 'DEC' })}>Decrement</button>
      </div>
    );
  };
  ```

## 1.4.0

### Minor Changes

- [`849ec56c`](https://github.com/statelyai/xstate/commit/849ec56c2a9db34e65a30af94e68a7a7a50b4158) [#2286](https://github.com/statelyai/xstate/pull/2286) Thanks [@davidkpiano](https://github.com/statelyai)! - The `useService(...)` hook will be deprecated, since services are also actors. In future versions, the `useActor(...)` hook should be used instead:

  ```diff
  -const [state, send] = useService(service);
  +const [state, send] = useActor(service);
  ```

### Patch Changes

- [`ea3aaffb`](https://github.com/statelyai/xstate/commit/ea3aaffb906b34a42bb2736c7b91d54ffe9ed882) [#2326](https://github.com/statelyai/xstate/pull/2326) Thanks [@davidkpiano](https://github.com/statelyai)! - The `send` type returned in the tuple from `useActor(someService)` was an incorrect `never` type; this has been fixed.

## 1.3.4

### Patch Changes

- [`aa3c2991`](https://github.com/statelyai/xstate/commit/aa3c29916b7382fbcf1a3efb183ca1e8eb625480) [#2223](https://github.com/statelyai/xstate/pull/2223) Thanks [@davidkpiano](https://github.com/statelyai)! - Support for actor refs with the `.getSnapshot()` method (added for spawned actors in XState version 4.19) is now supported in the `useActor(...)` hook.

## 1.3.3

### Patch Changes

- [`27e7242c`](https://github.com/statelyai/xstate/commit/27e7242c24146de85cf618a658b400a3241fa7d7) [#2112](https://github.com/statelyai/xstate/pull/2112) Thanks [@davidkpiano](https://github.com/statelyai)! - The `executeEffect` function is no longer exported (was meant to be internal and is useless as a public function anyway). This also fixes a circular dependency issue.

## 1.3.2

### Patch Changes

- [`bb5e81ea`](https://github.com/statelyai/xstate/commit/bb5e81eaa1ecba1fd54a7677ce9eaee9bd695964) [#2050](https://github.com/statelyai/xstate/pull/2050) Thanks [@theKashey](https://github.com/theKashey)! - Added an explicit entrypoint for `@xstate/react/fsm` which you can use instead of `@xstate/react/lib/fsm`. This is the only specifier that will be supported in the future - the other one will be dropped in the next major version.

  ```diff
  -import { useMachine } from '@xstate/react/lib/fsm'
  +import { useMachine } from '@xstate/react/fsm'
  ```

## 1.3.1

### Patch Changes

- [`b076b253`](https://github.com/statelyai/xstate/commit/b076b25364224874f62e8065892be40dfbb28030) [#1947](https://github.com/statelyai/xstate/pull/1947) Thanks [@lukekarrys](https://github.com/lukekarrys)! - Fix typing of the service returned from the fsm useMachine hook by passing it Typestate

- [`9b5dc784`](https://github.com/statelyai/xstate/commit/9b5dc7843c44f50bcca0ffccb843b3d50cef6ddc) [#1950](https://github.com/statelyai/xstate/pull/1950) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an issue with `toObserver` being internally imported from `xstate/lib/utils` which has broken UMD build and the declared peer dep contract.

## 1.3.0

### Minor Changes

- [`577ae023`](https://github.com/statelyai/xstate/commit/577ae02384926b49e876011c4393f212b49066f8) [#1915](https://github.com/statelyai/xstate/pull/1915) Thanks [@davidkpiano](https://github.com/statelyai)! - New hook: `useInterpret(machine)`, which is a low-level hook that interprets the `machine` and returns the `service`:

  ```js
  import { useInterpret } from '@xstate/react';
  import { someMachine } from '../path/to/someMachine';

  const App = () => {
    const service = useInterpret(someMachine);

    // ...
  };
  ```

- [`577ae023`](https://github.com/statelyai/xstate/commit/577ae02384926b49e876011c4393f212b49066f8) [#1915](https://github.com/statelyai/xstate/pull/1915) Thanks [@davidkpiano](https://github.com/statelyai)! - New hook: `useSelector(actor, selector)`, which subscribes to `actor` and returns the selected state derived from `selector(snapshot)`:

  ```js
  import { useSelector } from '@xstate/react';

  const App = ({ someActor }) => {
    const count = useSelector(someActor, (state) => state.context.count);

    // ...
  };
  ```

## 1.2.2

### Patch Changes

- [`4b31cefb`](https://github.com/statelyai/xstate/commit/4b31cefb3d3497e5515314046639df7e27dbe9e8) [#1780](https://github.com/statelyai/xstate/pull/1780) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an issue with some external packages not being bundled correctly into the UMD bundles.

## 1.2.1

### Patch Changes

- [`a16a5f2f`](https://github.com/statelyai/xstate/commit/a16a5f2ff5ba9d4d7834ec3ca2d0adecf5d6a870) [#1756](https://github.com/statelyai/xstate/pull/1756) Thanks [@dimitardanailov](https://github.com/dimitardanailov)! - Fixed an issue with `process` references not being removed correctly from the UMD bundles.

## 1.2.0

### Minor Changes

- [`dd98296e`](https://github.com/statelyai/xstate/commit/dd98296e9fcbae905da2395e67e876e28be7c774) [#1738](https://github.com/statelyai/xstate/pull/1738) Thanks [@dimitardanailov](https://github.com/dimitardanailov)! - Added UMD bundle.

## 1.1.0

### Minor Changes

- [`89f9c27c`](https://github.com/statelyai/xstate/commit/89f9c27c453dc56bdfdf49c8ea1f0f87ff1f9b67) [#1622](https://github.com/statelyai/xstate/pull/1622) Thanks [@davidkpiano](https://github.com/statelyai)! - Spawned/invoked actors and interpreters are now typed as extending `ActorRef` rather than `Actor` or `Interpreter`. This unification of types should make it more straightforward to provide actor types in React:

  ```ts
  import { ActorRef } from 'xstate';
  import { useActor } from '@xstate/react';

  const Child: React.FC<{ actorRef: ActorRef<SomeEvent, SomeEmitted> }> = ({
    actorRef
  }) => {
    // `state` is typed as `SomeEmitted`
    // `send` can be called with `SomeEvent` values
    const [state, send] = useActor(actorRef);

    // . ..
  };
  ```

  It's also easier to specify the type of a spawned/invoked machine with `ActorRefFrom`:

  ```ts
  import { createMachine, ActorRefFrom } from 'xstate';
  import { useActor } from '@xstate/react';

  const someMachine = createMachine<SomeContext, SomeEvent>({
    // ...
  });

  const Child: React.FC<{ someRef: ActorRefFrom<typeof someMachine> }> = ({
    someRef
  }) => {
    // `state` is typed as `State<SomeContext, SomeEvent>`
    // `send` can be called with `SomeEvent` values
    const [state, send] = useActor(someRef);

    // . ..
  };
  ```

## 1.0.3

### Patch Changes

- [`27db2950`](https://github.com/statelyai/xstate/commit/27db295064d42cacb89ff10d55f39eb7609148e1) [#1636](https://github.com/statelyai/xstate/pull/1636) Thanks [@Andarist](https://github.com/Andarist)! - Allow React 17 in the specified peer dependency range.

## 1.0.2

### Patch Changes

- [`c7927083`](https://github.com/statelyai/xstate/commit/c7927083a651e3c51952ade2ffda793df0391bf6) [#1516](https://github.com/statelyai/xstate/pull/1516) Thanks [@davidkpiano](https://github.com/statelyai)! - The `send` function returned from the `useService()` now can take two arguments (an event type and payload), to match the behavior of `@xstate/react` version 0.x.

- [`db77623a`](https://github.com/statelyai/xstate/commit/db77623a48955d762cffa9b624f438220add5eed) [#1516](https://github.com/statelyai/xstate/pull/1516) Thanks [@davidkpiano](https://github.com/statelyai)! - The `send` value returned from the `useService()` hook will now accept a payload, which matches the signature of the `send` value returned from the `useMachine()` hook:

  ```js
  const [state, send] = useService(someService);

  // ...

  // this is OK:
  send('ADD', { value: 3 });

  // which is equivalent to:
  send({ type: 'ADD', value: 3 });
  ```

- [`93f6db02`](https://github.com/statelyai/xstate/commit/93f6db02a2d56ec997198ddef0af3d7730bb79bb) [#1594](https://github.com/statelyai/xstate/pull/1594) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an issue with internal `setState` in `useService` being called with 2 arguments instead of 1.

- [`72b0880e`](https://github.com/statelyai/xstate/commit/72b0880e6444ae009adca72088872bb5c0760ce3) [#1504](https://github.com/statelyai/xstate/pull/1504) Thanks [@Andarist](https://github.com/Andarist)! - Fixed issue with `useService` returning an initial state for services in their final states.

## 1.0.1

### Patch Changes

- [`c0bd0407`](https://github.com/statelyai/xstate/commit/c0bd040767dcac20ed690e49a8725b4f1011dd5d) [#1493](https://github.com/statelyai/xstate/pull/1493) Thanks [@davidkpiano](https://github.com/statelyai)! - There will now be a descriptive error when trying to use an actor-like object in the `useService()` hook, where `useActor()` should be preferred:

  > Attempted to use an actor-like object instead of a service in the useService() hook. Please use the useActor() hook instead.

All notable changes to this project will be documented in this file.

## [1.0.0-rc.7]

- The `machine` passed into `useMachine(machine)` can now be passed in lazily:

  ```js
  const [state, send] = useMachine(() => createMachine(/* ... */));

  // ...
  ```

  This has the benefit of avoiding unnecessary machine initializations whenever the component rerenders.

- The `useActor` hook now takes a second argument: `getSnapshot` which is a function that should return the last emitted value:

  ```js
  const [state, send] = useActor(someActor, (actor) => actor.current);
  ```

## [1.0.0-rc.6]

## [1.0.0-rc.5]

- You can now schedule actions in `useEffect` or `useLayoutEffect` via:
  - `asEffect` - queues the action to be executed in `useEffect`
  - `asLayoutEffect` - queues the action to be executed in `useLayoutEffect`

```jsx
import { createMachine } from 'xstate';
import { useMachine, asEffect } from '@xstate/react';

const machine = createMachine({
  initial: 'focused',
  states: {
    focused: {
      entry: 'focus'
    }
  }
});

const Input = () => {
  const inputRef = useRef(null);
  const [state, send] = useMachine(machine, {
    actions: {
      focus: asEffect(() => {
        inputRef.current && inputRef.current.focus();
      })
    }
  });

  return <input ref={inputRef} />;
};
```

## [0.8.1]

- Services are now kept up to date

## [0.8.0]

- The `useActor()` hook is now available.
- Support for persisted states

## [0.7.1]

- Actions passed into `useMachine(..., { actions: { ... } })` will now be kept up-to-date and no longer reference stale data.

## [0.7.0]

### Added

- Machine configuration can now be merged into the options argument of `useMachine(machine, options)`. The following Machine Config options are available: `guards`, `actions`, `activities`, `services`, `delays` and `updates` (NOTE: `context` option is not implemented yet, use `withContext` or `withConfig` instead for the meantime)

```js
const [current, send] = useMachine(someMachine, {
  actions: {
    doThing: doTheThing
  },
  services: {
    /* ... */
  },
  guards: {
    /* ... */
  }
  // ... etc.
});
```
