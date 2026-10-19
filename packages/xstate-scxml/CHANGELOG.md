# @xstate/scxml

## 1.0.0-alpha.3

### Patch Changes

- 5b6df81: SCXML `done.invoke.<id>` and `done.state.<id>` transitions now match `xstate.done.actor` and `xstate.done.state` events by their `actorId` and `stateId`. Behavior is unchanged for SCXML documents.
- ceeebb0: An SCXML document without a `name` creates a machine without an `id` (`machine.id` is `''`) instead of one named `(machine)`, matching `createMachine`. The `_name` system variable is `''` for such documents.

## 1.0.0-alpha.2

### Minor Changes

- d2c518b: `In(...)` and `!In(...)` conditions convert to the `@xstate.stateIn` and `@xstate.not` guard types (previously `xstate.stateIn` and `xstate.not`).

## 1.0.0-alpha.1

### Minor Changes

- aa49aee: Add `@xstate/scxml`, which provides `createMachineFromSCXML(...)` (previously the `xstate/scxml` entry point).
  
  ```ts
  import { createMachineFromSCXML } from '@xstate/scxml';
  
  const machine = createMachineFromSCXML(scxmlString);
  ```
