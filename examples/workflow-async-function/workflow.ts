import { types, createMachine, createAsyncLogic } from 'xstate';
// https://github.com/serverlessworkflow/specification/tree/main/examples#async-function-invocation-example
export const workflow = createMachine({
  schemas: {
    context: types<{ customer: string }>(),
    input: types<{
      customer: string;
    }>()
  },
  actors: {
    sendEmail: createAsyncLogic({
      schemas: {
        input: types<{
          customer: string;
        }>()
      },
      run: async ({ input }) => {
        console.log('Sending email to', input.customer);
        await new Promise<void>((resolve) =>
          setTimeout(() => {
            console.log('Email sent to', input.customer);
            resolve();
          }, 1000)
        );
      }
    })
  },
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
        onDone: { target: 'Email sent' }
      }
    },
    'Email sent': {
      type: 'final'
    }
  }
});
