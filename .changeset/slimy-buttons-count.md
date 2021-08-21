---
'xstate': minor
---

Actions are now supported in the machine config's `.schema` property:

```ts
import { createMachine, createSchema } from 'xstate';

const machine = createMachine({
  schema: {
    actions: createSchema<
      { type: 'greet'; message: string } | { type: 'sayHello' }
    >()
  },
  entry: [
    { type: 'greet', message: 'hello' },
    { type: 'sayHello' },

    // @ts-expect-error (missing `message`)
    { type: 'greet' },

    // @ts-expect-error
    { type: 'other' }
  ]
});
```
