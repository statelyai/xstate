---
'xstate': minor
---

### Removed

- The `xstate/scxml` entry point moved to the new `@xstate/scxml` package. `xstate` no longer depends on `saxes`.

```ts
// Before
import { createMachineFromSCXML } from 'xstate/scxml';

// After (npm i @xstate/scxml)
import { createMachineFromSCXML } from '@xstate/scxml';
```
