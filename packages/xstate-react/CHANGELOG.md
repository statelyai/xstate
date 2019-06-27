# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

## [0.7.0]

### Added

- Machine configuration can now be merged into the options argument of `useMachine(machine, options)`:

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
