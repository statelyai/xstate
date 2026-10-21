---
'xstate': patch
---

`serializeMachine(...)` and `createMachineFromConfig(...)` now represent inline functions (guards, actions, transitions, delays, route functions) as `{ '@code': string, '@lang': 'ts' }`. Non-portable values such as actor logic, runtime schemas, class instances, symbols, and bigints are omitted from the serialized JSON.

```ts
import { serializeMachine } from 'xstate';

serializeMachine(machine);
// inline functions → { '@code': '() => true', '@lang': 'ts' }
```

Type-only refinements: `void` and `undefined` are accepted as type-only schemas, async logic output is inferred from an input-only schema, actions/guards can be typed via `schemas`, and `trigger` is correctly typed on spawned actors.
