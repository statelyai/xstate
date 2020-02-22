# xstate

## 4.7.8

### Patch Changes

- [`520580b`](https://github.com/davidkpiano/xstate/commit/520580b4af597f7c83c329757ae972278c2d4494) [#967](https://github.com/davidkpiano/xstate/pull/967) Thanks [@andrewgordstewart](https://github.com/andrewgordstewart)! - Add context & event types to InvokeConfig

## 4.7.7

### Patch Changes

- [`c8db035`](https://github.com/davidkpiano/xstate/commit/c8db035b90a7ab4a557359d493d3dd7973dacbdd) [#936](https://github.com/davidkpiano/xstate/pull/936) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The `escalate()` action can now take in an expression, which will be evaluated against the `context`, `event`, and `meta` to return the error data.

* [`2a3fea1`](https://github.com/davidkpiano/xstate/commit/2a3fea18dcd5be18880ad64007d44947cc327d0d) [#952](https://github.com/davidkpiano/xstate/pull/952) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The typings for the raise() action have been fixed to allow any event to be raised. This typed behavior will be refined in version 5, to limit raised events to those that the machine accepts.

- [`f86d419`](https://github.com/davidkpiano/xstate/commit/f86d41979ed108e2ac4df63299fc16f798da69f7) [#957](https://github.com/davidkpiano/xstate/pull/957) Thanks [@Andarist](https://github.com/Andarist)! - Fixed memory leak - each created service has been registered in internal map but it was never removed from it. Registration has been moved to a point where Interpreter is being started and it's deregistered when it is being stopped.

## 4.7.6

### Patch Changes

- dae8818: Typestates are now propagated to interpreted services.

## 4.7.5

### Patch Changes

- 6b3d767: Fixed issue with delayed transitions scheduling a delayed event for each transition defined for a single delay.

## 4.7.4

### Patch Changes

- 9b043cd: The initial state is now cached inside of the service instance instead of the machine, which was the previous (faulty) strategy. This will prevent entry actions on initial states from being called more than once, which is important for ensuring that actors are not spawned more than once.

## 4.7.3

### Patch Changes

- 2b134eee: Fixed issue with events being forwarded to children after being processed by the current machine. Events are now always forwarded first.
- 2b134eee: Fixed issue with not being able to spawn an actor when processing an event batch.
