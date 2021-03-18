---
'xstate': minor
---

The `schema` property has been introduced to the machine config passed into `createMachine(machineConfig)`, which allows you to provide metadata for the following:

- Context
- Events
- Actions
- Guards
- Services

This metadata can be accessed as-is from `machine.schema`:

```js
const machine = createMachine({
  schema: {
    // Example in JSON Schema (anything can be used)
    context: {
      type: 'object',
      properties: {
        foo: { type: 'string' },
        bar: { type: 'number' },
        baz: {
          type: 'object',
          properties: {
            one: { type: 'string' }
          }
        }
      }
    },
    events: {
      FOO: { type: 'object' },
      BAR: { type: 'object' }
    }
  }
  // ...
});
```

Additionally, the new `createSchema()` identity function allows any schema "metadata" to be represented by a specific type, which makes type inference easier without having to specify generic types:

```ts
import { createSchema, createMachine } from 'xstate';

// Both `context` and `events` are inferred in the rest of the machine!
const machine = createMachine({
  schema: {
    context: createSchema<{ count: number }>({
      // ...
    }),
    // No arguments necessary
    events: createSchema<{ type: 'FOO' } | { type: 'BAR' }>()
  }
  // ...
});
```
