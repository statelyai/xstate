---
title: Build forms and wizards
description: Model form steps and store submitted values in context.
---

Use states for steps and context for field values. Each step validates the value it receives before moving to the next step.

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

## Validation is a guard

A step's `next` returns `undefined` when the value is not acceptable. The event is unhandled, the state does not change, and nothing is written to context. There is no separate `isValid` flag to keep in sync, because an invalid value never becomes state. See [guards](guards.md).

Validation that needs a server, such as checking whether an email is already registered, is not a guard. [Invoke](invoke.md) an actor from a `checking` state and branch on its result.

## A complete wizard

Steps go forward with `next` and backward with `back`, collecting into one partial draft. A `review` step reads the whole draft, and only `review` can start the submission.

```ts
type Draft = { name: string; email: string; plan: string };

const createAccount = createAsyncLogic<{ id: string }, Draft>({
  run: async ({ input, signal }) => {
    const response = await fetch('/api/accounts', {
      method: 'POST',
      body: JSON.stringify(input),
      signal
    });
    if (!response.ok) throw new Error('Could not create the account');
    return response.json();
  }
});

const signupMachine = createMachine({
  context: {
    draft: { name: '', email: '', plan: 'free' } as Draft,
    error: null as string | null
  },
  initial: 'name',
  states: {
    name: {
      on: {
        next: ({ context, event }) => {
          if (event.value.trim() === '') return;
          const draft = { ...context.draft, name: event.value };
          return { target: 'email', context: { ...context, draft } };
        }
      }
    },
    email: {
      on: {
        back: { target: 'name' },
        next: ({ context, event }) => {
          if (!event.value.includes('@')) return;
          const draft = { ...context.draft, email: event.value };
          return { target: 'review', context: { ...context, draft } };
        }
      }
    },
    review: {
      on: {
        edit: ({ event }) => {
          if (event.step === 'name') return { target: 'name' };
          return { target: 'email' };
        },
        submit: { target: 'submitting' }
      }
    },
    submitting: {
      invoke: {
        src: createAccount,
        input: ({ context }) => context.draft,
        onDone: { target: 'complete' },
        onError: ({ context, event }) => ({
          target: 'failed',
          context: { ...context, error: (event.error as Error).message }
        })
      }
    },
    failed: {
      on: {
        retry: { target: 'submitting' },
        back: { target: 'review' }
      }
    },
    complete: { type: 'final' }
  }
});
```

The draft is never partially submitted: `submitting` is the only state that invokes the request, and only `review` reaches it. A failure goes to `failed`, which keeps the draft intact and offers both a retry and a way back to the form.

## Returning to where you were

`edit` jumps to a named step, which works when each edit button knows its destination. When the wizard should resume wherever it was, such as after a preview or a login prompt, record the step with a [history state](history-states.md) instead:

```ts
steps: {
  initial: 'name',
  states: {
    name: {},
    email: {},
    hist: { type: 'history', target: 'name' }
  }
},
review: {
  on: { edit: { target: 'steps.hist' } }
}
```

## Values that belong to one step

Data handed to a single step, rather than to the whole form, can travel with the transition as [state input](state-input.md) instead of being written to context. Keep the draft in context while it is still being edited; use state input for what a state is given as it is entered.

Use this shape for account onboarding and multi-step checkout. Put fields in context, steps in states and validation rules in transition functions or guards.

## What next?

- [Return `undefined` to block a transition](guards.md).
- [Run the submission as an invoked actor](invoke.md).
- [Retry a failed submission](retries-and-timeouts.md).
- [Save a half-finished form across a refresh](persistence.md).
