import { createMachine, fromPromise, interpret } from 'xstate';

// https://github.com/serverlessworkflow/specification/tree/main/examples#async-function-invocation-example
export const workflow = createMachine(
  {
    id: 'async-function-invocation',
    initial: 'Send email',
    context: ({ input }) => ({
      customer: input.customer
    }),
    states: {
      'Send email': {
        invoke: {
          src: 'sendEmail',
          input: ({ context }) => ({
            customer: context.customer
          }),
          onDone: 'Email sent'
        }
      },
      'Email sent': {
        type: 'final'
      }
    }
  },
  {
    actors: {
      sendEmail: fromPromise(async ({ input }) => {
        console.log('Sending email to', input.customer);

        await new Promise<void>((resolve) =>
          setTimeout(() => {
            console.log('Email sent to', input.customer);
            resolve();
          }, 1000)
        );
      })
    }
  }
);

const actor = interpret(workflow, {
  input: {
    customer: 'david@example.com'
  }
});

actor.subscribe({
  complete() {
    console.log('workflow completed', actor.getSnapshot().output);
  }
});

actor.start();
