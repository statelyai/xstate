import { setup, types, createAsyncLogic } from 'xstate';

export type Session = {
  user: string;
  token: string;
  expiresAt: number;
};

type Credentials = { email: string; password: string };

const TOKEN_LIFETIME = 10_000;
const REFRESH_INTERVAL = 4_000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** The only account the mock backend knows about. */
const VALID = { email: 'ada@example.com', password: 'lovelace' };

const authenticate = createAsyncLogic({
  schemas: { input: types<Credentials>() },
  run: async ({ input }): Promise<Session> => {
    await sleep(800);

    if (input.email !== VALID.email || input.password !== VALID.password) {
      throw new Error('Incorrect email or password.');
    }

    return {
      user: input.email,
      token: crypto.randomUUID(),
      expiresAt: Date.now() + TOKEN_LIFETIME
    };
  }
});

const refreshToken = createAsyncLogic({
  schemas: { input: types<{ session: Session }>() },
  run: async ({ input }): Promise<Session> => {
    await sleep(500);

    // The mock backend refuses to refresh a token that already expired.
    if (Date.now() > input.session.expiresAt) {
      throw new Error('Refresh token rejected.');
    }

    return {
      ...input.session,
      token: crypto.randomUUID(),
      expiresAt: Date.now() + TOKEN_LIFETIME
    };
  }
});

type AuthContext = {
  credentials: Credentials | null;
  session: Session | null;
  error: string | null;
};

export const authMachine = setup({
  schemas: {
    context: types<AuthContext>(),
    events: {
      submit: types<Credentials>(),
      logout: types<{}>(),
      expire: types<{}>(),
      retry: types<{}>()
    }
  },
  actors: { authenticate, refreshToken },
  delays: { refreshInterval: REFRESH_INTERVAL }
}).createMachine({
  id: 'auth',
  context: { credentials: null, session: null, error: null },
  initial: 'loggedOut',
  states: {
    loggedOut: {
      on: {
        submit: ({ event }) => ({
          target: 'authenticating',
          context: {
            error: null,
            credentials: { email: event.email, password: event.password }
          }
        })
      }
    },
    authenticating: {
      invoke: {
        src: authenticate,
        input: ({ context }) => context.credentials!,
        onDone: ({ event }) => ({
          target: 'authenticated',
          context: { session: event.output, error: null, credentials: null }
        }),
        onError: ({ event }) => ({
          target: 'loggedOut',
          context: { error: (event.error as Error).message }
        })
      }
    },
    authenticated: {
      initial: 'idle',
      on: {
        logout: {
          target: 'loggedOut',
          actions: () => ({ context: { session: null, error: null } })
        },
        expire: { target: 'sessionExpired' }
      },
      states: {
        idle: {
          // Silent token refresh on an interval, the way a real app keeps a
          // session alive without the user noticing.
          after: { refreshInterval: { target: 'refreshing' } }
        },
        refreshing: {
          invoke: {
            src: refreshToken,
            input: ({ context }) => ({ session: context.session! }),
            onDone: ({ event }) => ({
              target: 'idle',
              context: { session: event.output }
            }),
            onError: ({ event }) => ({
              target: '#auth.sessionExpired',
              context: { error: (event.error as Error).message }
            })
          }
        }
      }
    },
    sessionExpired: {
      on: {
        retry: ({ context }) => ({
          target: 'loggedOut',
          context: { session: null, error: context.error }
        }),
        logout: {
          target: 'loggedOut',
          actions: () => ({ context: { session: null, error: null } })
        }
      }
    }
  }
});
