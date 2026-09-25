---
'@xstate/scxml': minor
---

Add `@xstate/scxml`, which provides `createMachineFromSCXML(...)` (previously the `xstate/scxml` entry point).

```ts
import { createMachineFromSCXML } from '@xstate/scxml';

const machine = createMachineFromSCXML(scxmlString);
```
