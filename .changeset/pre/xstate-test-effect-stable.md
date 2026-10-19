---
'@xstate/test': major
---

`@xstate/test/effect-schema` now requires stable Effect 4 (`effect@^4.0.0`). `fromEffectSchema()` builds fast-check arbitraries from the schema's AST. It supports primitives, literals, enums, unions, arrays, tuples, structs with optional properties, records with string keys, and refinements. Unsupported nodes such as `Schema.Date` throw an error naming the node. Pass `override` to supply an arbitrary for them:

```ts
import * as fc from 'fast-check';
import * as Schema from 'effect/Schema';
import { fromEffectSchema } from '@xstate/test/effect-schema';

fromEffectSchema(Schema.Struct({ at: Schema.Date }), {
  override: (ast) =>
    ast._tag === 'Declaration' ? fc.date({ noInvalidDate: true }) : undefined
});
```
