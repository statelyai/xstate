---
'xstate': patch
---

Add `createMachineFromSCXML(...)` through the `xstate/scxml` entry point. Converted machines follow strict SCXML behavior for transition selection, executable content, datamodel evaluation, invocation, event metadata, and completion.

```ts
import { createMachineFromSCXML } from 'xstate/scxml';

const machine = createMachineFromSCXML(scxml);
```
