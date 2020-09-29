# Changelog

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
