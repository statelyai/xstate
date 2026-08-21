import { setup, types, createAsyncLogic } from 'xstate';

export type Role = 'developer' | 'designer' | 'manager';

export type SignupContext = {
  email: string;
  password: string;
  name: string;
  role: Role | '';
  attempts: number;
  error: string | null;
};

/** Validation shared by the machine and the UI, so both agree on the rules. */
export function accountErrors(context: SignupContext): string[] {
  const errors: string[] = [];

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(context.email)) {
    errors.push('Enter a valid email address.');
  }
  if (context.password.length < 8) {
    errors.push('Password must be at least 8 characters.');
  }

  return errors;
}

export function profileErrors(context: SignupContext): string[] {
  const errors: string[] = [];

  if (context.name.trim().length < 2) {
    errors.push('Name must be at least 2 characters.');
  }
  if (context.role === '') {
    errors.push('Pick a role.');
  }

  return errors;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Mock signup endpoint: fails the first time, succeeds on retry. */
const createAccount = createAsyncLogic({
  schemas: {
    input: types<{
      email: string;
      name: string;
      role: Role | '';
      attempt: number;
    }>()
  },
  run: async ({ input }): Promise<{ id: string; email: string }> => {
    await sleep(900);

    if (input.attempt === 1) {
      throw new Error('The signup service is temporarily unavailable.');
    }

    return { id: crypto.randomUUID().slice(0, 8), email: input.email };
  }
});

export const signupMachine = setup({
  schemas: {
    context: types<SignupContext>(),
    events: {
      setEmail: types<{ value: string }>(),
      setPassword: types<{ value: string }>(),
      setName: types<{ value: string }>(),
      setRole: types<{ value: Role | '' }>(),
      next: types<{}>(),
      back: types<{}>(),
      submit: types<{}>(),
      retry: types<{}>()
    }
  },
  actors: { createAccount }
}).createMachine({
  id: 'signup',
  context: {
    email: '',
    password: '',
    name: '',
    role: '',
    attempts: 0,
    error: null
  },
  initial: 'account',
  states: {
    account: {
      on: {
        setEmail: ({ event }) => ({ context: { email: event.value } }),
        setPassword: ({ event }) => ({ context: { password: event.value } }),
        // Returning nothing blocks the transition, so an invalid step cannot
        // advance. There is no separate `guard` key in v6.
        next: ({ context }) => {
          if (accountErrors(context).length === 0) {
            return { target: 'profile' };
          }
        }
      }
    },
    profile: {
      on: {
        setName: ({ event }) => ({ context: { name: event.value } }),
        setRole: ({ event }) => ({ context: { role: event.value } }),
        next: ({ context }) => {
          if (profileErrors(context).length === 0) {
            return { target: 'confirm' };
          }
        },
        back: { target: 'account' }
      }
    },
    confirm: {
      on: {
        submit: ({ context }) => ({
          target: 'submitting',
          context: { attempts: context.attempts + 1, error: null }
        }),
        back: { target: 'profile' }
      }
    },
    submitting: {
      invoke: {
        src: 'createAccount',
        input: ({ context }) => ({
          email: context.email,
          name: context.name,
          role: context.role,
          attempt: context.attempts
        }),
        onDone: () => ({ target: 'done' }),
        onError: ({ event }) => ({
          target: 'submitFailed',
          context: { error: (event.error as Error).message }
        })
      }
    },
    submitFailed: {
      on: {
        retry: ({ context }) => ({
          target: 'submitting',
          context: { attempts: context.attempts + 1, error: null }
        }),
        back: { target: 'confirm' }
      }
    },
    done: { type: 'final' }
  }
});
