import { setup, types } from 'xstate';

export type Plan = 'free' | 'pro' | '';

export type WizardContext = {
  email: string;
  password: string;
  street: string;
  city: string;
  plan: Plan;
};

/**
 * Validation lives in plain functions so the machine and the UI apply the same
 * rules: the machine blocks the transition, the UI shows the messages.
 */
export function accountErrors(email: string, password: string): string[] {
  const errors: string[] = [];

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    errors.push('Enter a valid email address.');
  }
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters.');
  }

  return errors;
}

export function addressErrors(street: string, city: string): string[] {
  const errors: string[] = [];

  if (street.trim() === '') {
    errors.push('Street is required.');
  }
  if (city.trim() === '') {
    errors.push('City is required.');
  }

  return errors;
}

export function planErrors(plan: Plan): string[] {
  return plan === '' ? ['Pick a plan.'] : [];
}

export const wizardMachine = setup({
  schemas: {
    context: types<WizardContext>(),
    events: {
      setEmail: types<{ value: string }>(),
      setPassword: types<{ value: string }>(),
      setStreet: types<{ value: string }>(),
      setCity: types<{ value: string }>(),
      setPlan: types<{ value: 'free' | 'pro' }>(),
      next: types<{}>(),
      back: types<{}>(),
      restart: types<{}>()
    }
  }
}).createMachine({
  id: 'wizard',
  context: { email: '', password: '', street: '', city: '', plan: '' },
  initial: 'account',
  on: {
    setEmail: ({ event }) => ({ context: { email: event.value } }),
    setPassword: ({ event }) => ({ context: { password: event.value } }),
    setStreet: ({ event }) => ({ context: { street: event.value } }),
    setCity: ({ event }) => ({ context: { city: event.value } }),
    setPlan: ({ event }) => ({ context: { plan: event.value } })
  },
  states: {
    // Each step's `next` is a transition function: returning nothing blocks the
    // transition, so an invalid step cannot advance. There is no `guard` key in
    // v6.
    account: {
      on: {
        next: ({ context }) =>
          accountErrors(context.email, context.password).length === 0
            ? { target: 'address' }
            : undefined
      }
    },
    address: {
      on: {
        next: ({ context }) =>
          addressErrors(context.street, context.city).length === 0
            ? { target: 'plan' }
            : undefined,
        back: { target: 'account' }
      }
    },
    plan: {
      on: {
        next: ({ context }) =>
          planErrors(context.plan).length === 0
            ? { target: 'done' }
            : undefined,
        back: { target: 'address' }
      }
    },
    done: {
      on: {
        restart: () => ({
          target: 'account',
          context: { email: '', password: '', street: '', city: '', plan: '' }
        })
      }
    }
  }
});
