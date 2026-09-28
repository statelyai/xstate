# @xstate/scxml

## 1.0.0-alpha.1

### Minor Changes

- aa49aee: Add `@xstate/scxml`, which provides `createMachineFromSCXML(...)` (previously the `xstate/scxml` entry point).
  
  ```ts
  import { createMachineFromSCXML } from '@xstate/scxml';
  
  const machine = createMachineFromSCXML(scxmlString);
  ```
