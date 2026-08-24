---
'xstate': minor
---

Add opt-in runtime Standard Schema validation through `setup({ validator })`. The standard validator is available from the separate `xstate/validation` entrypoint:

```ts
import { setup } from 'xstate';
import { standardSchemaValidator } from 'xstate/validation';
import { z } from 'zod';

const machine = setup({
  validator: standardSchemaValidator(),
  schemas: {
    events: {
      increment: z.object({ by: z.number() })
    }
  }
}).createMachine({});
```

Validation covers machine input and incoming public events before calculation. It validates stable context, active state input and context contracts, final output, child slots, delayed raised-event timers, and emitted events before returning a completed macrostep. Validation asserts runtime values without applying schema transformations.

Derived setups inherit validation unless they explicitly replace it or disable it with `validator: undefined`.

The same validator can be installed on `createLogic()`, async, callback, and observable logic configurations. Those actors validate their existing input and output schema boundaries.

Named action and guard parameters, immediate raised events, static meta and tags, persistence, restoration, and `snapshot.can()` are not validation boundaries in this initial release.
