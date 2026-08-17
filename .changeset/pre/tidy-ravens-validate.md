---
'xstate': patch
---

Fixed `createSystem(...).setup(...)` to preserve runtime validator types alongside typed actor registries. Validated setups now reject unsupported transforming schemas and carry validation into derived setups.

Runtime validation can now also be installed on a derived setup when its inherited schemas are compatible:

```ts
import { setup } from 'xstate';
import { standardSchemaValidator } from 'xstate/validation';
import { z } from 'zod';

const validated = setup({
  schemas: { input: z.object({ id: z.string() }) }
}).extend({ validator: standardSchemaValidator() });
```
