---
title: Build forms and wizards
description: Model form steps and store submitted values in context.
---

Use states for steps and context for field values.

```ts
import { z } from 'zod';
import { createActor, createMachine } from 'xstate';

const formMachine = createMachine({
  schemas: {
    events: {
      next: z.object({ value: z.string() }),
      back: z.object({})
    }
  },
  context: { name: '', email: '' },
  initial: 'name',
  states: {
    name: {
      on: {
        next: ({ context, event }) => ({
          target: 'email',
          context: { ...context, name: event.value }
        })
      }
    },
    email: {
      on: {
        back: { target: 'name' },
        next: ({ context, event }) => {
          if (!event.value.includes('@')) return;
          return {
            target: 'complete',
            context: { ...context, email: event.value }
          };
        }
      }
    },
    complete: { type: 'final' }
  }
});

const form = createActor(formMachine).start();
form.trigger.next({ value: 'Ada' });
form.trigger.next({ value: 'ada@example.com' });
```

The event schemas type the generated `trigger` methods.
