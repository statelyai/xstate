import { createMachine, types } from 'xstate';

/** The model of the three-step form in `public/index.html`. */
export const formMachine = createMachine({
  id: 'form',
  schemas: {
    context: types<{ name: string; email: string; error: string }>(),
    events: {
      FILL: types<{ value: string }>(),
      NEXT: types<{}>(),
      BACK: types<{}>()
    }
  },
  context: { name: '', email: '', error: '' },
  initial: 'name',
  states: {
    name: {
      on: {
        // The page clears the error on `input`, which a fill that leaves the
        // value unchanged does not fire.
        FILL: ({ context, event }) =>
          event.value === context.name
            ? undefined
            : { context: { name: event.value, error: '' } },
        NEXT: ({ context }) =>
          context.name.trim().length > 0
            ? { target: 'email', context: { error: '' } }
            : { context: { error: 'name is required' } }
      }
    },
    email: {
      on: {
        FILL: ({ context, event }) =>
          event.value === context.email
            ? undefined
            : { context: { email: event.value, error: '' } },
        BACK: () => ({ target: 'name', context: { error: '' } }),
        NEXT: ({ context }) =>
          context.email.includes('@')
            ? { target: 'review', context: { error: '' } }
            : { context: { error: 'email is invalid' } }
      }
    },
    review: {
      on: {
        BACK: () => ({ target: 'email', context: { error: '' } }),
        NEXT: () => ({ target: 'done', context: { error: '' } })
      }
    },
    done: {}
  }
});
