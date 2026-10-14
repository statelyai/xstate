---
"xstate": patch
---

Fix declaration generation for exported `machine.provide({ actions })` variants and `createStateConfig()` fragments with invoke input mappers.

Entry and exit functions now receive a working `enq` regardless of their parameter count, including default/rest parameters and forwarding wrappers. Returned context and child patches are applied consistently. Functions that enqueue no effects no longer add placeholder effects to pure transition results.

```ts
import { createMachine } from 'xstate';

const machine = createMachine({
  initial: 'loading',
  states: {
    loading: {
      entry: (...[, enq]) => enq.raise({ type: 'ready' }),
      on: { ready: { target: 'ready' } }
    },
    ready: {}
  }
});
```
