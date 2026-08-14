import { createActor, setup, toPromise, types } from 'xstate';
// Actor creators are imported from the `xstate/actors` subpath so that this
// example runs under `tsx` against the workspace build.
import { createAsyncLogic } from 'xstate/actors';

const log = (message: string) =>
  console.log(`${Date.now() % 100000} ${message}`);

const wait = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Mock email sender, so the example runs offline. */
const sendEmail = createAsyncLogic({
  schemas: { input: types<{ to: string; template: string }>() },
  run: async ({ input }) => {
    await wait(50);
    log(`mailer: sent "${input.template}" to ${input.to}`);
    return input.template;
  }
});

/**
 * Real campaigns wait days between sends. The delays here are milliseconds so
 * the demo finishes, but nothing else about the machine changes.
 */
const dripMachine = setup({
  schemas: {
    context: types<{
      email: string;
      sent: string[];
      opens: number;
      clicks: number;
    }>(),
    events: {
      open: types<{}>(),
      click: types<{}>(),
      unsubscribe: types<{}>()
    },
    input: types<{ email: string }>()
  },
  delays: { day1: 600, day3: 700 }
}).createMachine({
  context: ({ input }) => ({
    email: input.email,
    sent: [],
    opens: 0,
    clicks: 0
  }),
  initial: 'welcome',
  // Engagement and unsubscribe can arrive in any state, so they are handled at
  // the machine level. `unsubscribe` halts the sequence wherever it is.
  on: {
    open: ({ context }, enq) => {
      enq(log, `${context.email}: opened`);
      return { context: { opens: context.opens + 1 } };
    },
    click: ({ context }, enq) => {
      enq(log, `${context.email}: clicked`);
      return { context: { clicks: context.clicks + 1 } };
    },
    unsubscribe: { target: '.unsubscribed' }
  },
  states: {
    welcome: {
      invoke: {
        src: sendEmail,
        input: ({ context }) => ({ to: context.email, template: 'welcome' }),
        onDone: ({ context, event }) => ({
          target: 'waitingDay1',
          context: { sent: [...context.sent, event.output] }
        })
      }
    },
    waitingDay1: {
      after: { day1: { target: 'day1Tip' } }
    },
    day1Tip: {
      invoke: {
        src: sendEmail,
        input: ({ context }) => ({ to: context.email, template: 'day1-tip' }),
        onDone: ({ context, event }) => ({
          target: 'waitingDay3',
          context: { sent: [...context.sent, event.output] }
        })
      }
    },
    // The branch: engaged subscribers get the upsell, quiet ones get a nudge.
    waitingDay3: {
      after: {
        day3: ({ context }) =>
          context.clicks > 0
            ? { target: 'day3Upsell' }
            : { target: 'day3Nudge' }
      }
    },
    day3Upsell: {
      invoke: {
        src: sendEmail,
        input: ({ context }) => ({
          to: context.email,
          template: 'day3-upsell'
        }),
        onDone: ({ context, event }) => ({
          target: 'completed',
          context: { sent: [...context.sent, event.output] }
        })
      }
    },
    day3Nudge: {
      invoke: {
        src: sendEmail,
        input: ({ context }) => ({ to: context.email, template: 'day3-nudge' }),
        onDone: ({ context, event }) => ({
          target: 'completed',
          context: { sent: [...context.sent, event.output] }
        })
      }
    },
    completed: {
      type: 'final',
      output: ({ context }) => ({
        email: context.email,
        outcome: 'completed',
        sent: context.sent,
        opens: context.opens,
        clicks: context.clicks
      })
    },
    unsubscribed: {
      type: 'final',
      entry: ({ context }, enq) =>
        enq(log, `${context.email}: unsubscribed, sequence halted`),
      output: ({ context }) => ({
        email: context.email,
        outcome: 'unsubscribed',
        sent: context.sent,
        opens: context.opens,
        clicks: context.clicks
      })
    }
  }
});

const subscribe = (email: string) => {
  const actor = createActor(dripMachine, { input: { email } });
  actor.subscribe((snapshot) =>
    log(`${email}: state ${JSON.stringify(snapshot.value)}`)
  );
  actor.start();
  return actor;
};

const engaged = subscribe('ada@example.com');
const leaving = subscribe('bob@example.com');

// Ada opens and clicks the day-1 tip, so she gets the upsell.
void wait(750).then(() => {
  engaged.send({ type: 'open' });
  engaged.send({ type: 'click' });
});

// Bob opens the welcome email, then unsubscribes before day 1.
void wait(200).then(() => leaving.send({ type: 'open' }));
void wait(400).then(() => leaving.send({ type: 'unsubscribe' }));

const results = await Promise.all([toPromise(engaged), toPromise(leaving)]);

for (const result of results) {
  log(`result: ${JSON.stringify(result)}`);
}
