import { createActor, createAsyncLogic, setup, toPromise } from 'xstate';
import { standardSchemaValidator } from 'xstate/validation';
import { createInspector } from '@statelyai/sdk';
import { z } from 'zod';

const inspector = process.env.INSPECT ? createInspector() : undefined;

const log = (message: string) => console.log(message);

const Signup = z.object({
  email: z.string().email(),
  plan: z.enum(['free', 'pro'])
});

const submitSignup = createAsyncLogic({
  validator: standardSchemaValidator(),
  schemas: { input: Signup },
  run: async ({ input }) => ({ accountId: `acct_${input.plan}_1` })
});

/**
 * Every schema here is a Zod schema, which XState accepts as a Standard
 * Schema. `validator: standardSchemaValidator()` is what turns them from
 * type-level declarations into runtime checks.
 */
const signupMachine = setup({
  validator: standardSchemaValidator(),
  schemas: {
    input: z.object({ source: z.string() }),
    context: z.object({
      source: z.string(),
      email: z.string(),
      plan: z.enum(['free', 'pro']),
      accountId: z.string().nullable()
    }),
    events: {
      // Payload schemas: XState adds the `type` key.
      submit: Signup,
      reset: z.object({})
    },
    output: z.object({ accountId: z.string() })
  },
  actors: { submitSignup }
}).createMachine({
  id: 'signup',
  context: ({ input }) => ({
    source: input.source,
    email: '',
    plan: 'free' as const,
    accountId: null
  }),
  initial: 'editing',
  states: {
    editing: {
      on: {
        submit: ({ event }) => ({
          target: 'submitting',
          context: { email: event.email, plan: event.plan }
        })
      }
    },
    submitting: {
      invoke: {
        src: 'submitSignup',
        input: ({ context }) => ({ email: context.email, plan: context.plan }),
        onDone: ({ event }) => ({
          target: 'done',
          context: { accountId: event.output.accountId }
        })
      }
    },
    done: {
      type: 'final',
      output: ({ context }) => ({ accountId: context.accountId! })
    }
  }
});

/** A fresh signup actor that reports validation failures on its error channel. */
const startSignup = (input: { source: string }) => {
  const actor = createActor(signupMachine, {
    input: input as never,
    inspect: inspector?.inspect
  });
  actor.subscribe({
    error: (error) => log(`   error channel: ${(error as Error).message}`)
  });
  actor.start();
  return actor;
};

log('1. a valid event runs the machine and the actor it invokes');
const ok = startSignup({ source: 'pricing-page' });
ok.send({ type: 'submit', email: 'ada@example.com', plan: 'pro' });
log(`   done: ${JSON.stringify(await toPromise(ok))}`);

log('\n2. an invalid payload never reaches a transition');
const bad = startSignup({ source: 'pricing-page' });
bad.send({ type: 'submit', email: 'not-an-email', plan: 'pro' });
log(`   state: ${JSON.stringify(bad.getSnapshot().value)}`);
log(`   status: ${bad.getSnapshot().status}`);

log('\n3. runtime validation catches what the types cannot vouch for');
const untrusted = JSON.parse(
  '{"type":"submit","email":"ada@example.com","plan":"enterprise"}'
);
const fromNetwork = startSignup({ source: 'pricing-page' });
// Data off a socket or a form is `any` at the boundary; only the schema checks it.
fromNetwork.send(untrusted);
log(`   status: ${fromNetwork.getSnapshot().status}`);

log('\n4. input is validated too, before the machine starts');
const badInput = startSignup({ source: 42 } as never);
log(`   status: ${badInput.getSnapshot().status}`);

inspector?.destroy();
