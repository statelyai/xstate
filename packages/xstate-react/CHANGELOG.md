# Changelog

## 1.0.2

### Patch Changes

- [`c7927083`](https://github.com/davidkpiano/xstate/commit/c7927083a651e3c51952ade2ffda793df0391bf6) [#1516](https://github.com/davidkpiano/xstate/pull/1516) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The `send` function returned from the `useService()` now can take two arguments (an event type and payload), to match the behavior of `@xstate/react` version 0.x.

* [`db77623a`](https://github.com/davidkpiano/xstate/commit/db77623a48955d762cffa9b624f438220add5eed) [#1516](https://github.com/davidkpiano/xstate/pull/1516) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The `send` value returned from the `useService()` hook will now accept a payload, which matches the signature of the `send` value returned from the `useMachine()` hook:

  ```js
  const [state, send] = useService(someService);

  // ...

  // this is OK:
  send('ADD', { value: 3 });

  // which is equivalent to:
  send({ type: 'ADD', value: 3 });
  ```

- [`93f6db02`](https://github.com/davidkpiano/xstate/commit/93f6db02a2d56ec997198ddef0af3d7730bb79bb) [#1594](https://github.com/davidkpiano/xstate/pull/1594) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an issue with internal `setState` in `useService` being called with 2 arguments instead of 1.

* [`72b0880e`](https://github.com/davidkpiano/xstate/commit/72b0880e6444ae009adca72088872bb5c0760ce3) [#1504](https://github.com/davidkpiano/xstate/pull/1504) Thanks [@Andarist](https://github.com/Andarist)! - Fixed issue with `useService` returning an initial state for services in their final states.

## 1.0.1

### Patch Changes

- [`c0bd0407`](https://github.com/davidkpiano/xstate/commit/c0bd040767dcac20ed690e49a8725b4f1011dd5d) [#1493](https://github.com/davidkpiano/xstate/pull/1493) Thanks [@davidkpiano](https://github.com/davidkpiano)! - There will now be a descriptive error when trying to use an actor-like object in the `useService()` hook, where `useActor()` should be preferred:

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
