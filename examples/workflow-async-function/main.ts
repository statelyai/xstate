import { fromPromise, createActor, setup } from 'xstate';

// https://github.com/serverlessworkflow/specification/tree/main/examples#async-function-invocation-example
export const workflow = setup({
  types: {
    input: {} as {
      customer: string;
    }
  },
  actors: {
    sendEmail: fromPromise(
      async ({ input }: { input: { customer: string } }) => {
        console.log('Sending email to', input.customer);

        await new Promise<void>((resolve) =>
          setTimeout(() => {
            console.log('Email sent to', input.customer);
            resolve();
          }, 1000)
        );
      }
    )
  }
}).createMachine({
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
});

const actor = createActor(workflow, {
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
