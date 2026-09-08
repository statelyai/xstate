import { types, createMachine, createAsyncLogic } from 'xstate';
interface Customer {
  id: string;
  name: string;
  SSN: number;
  yearlyIncome: number;
  address: string;
  employer: string;
}
// https://github.com/serverlessworkflow/specification/tree/main/examples#perform-customer-credit-check-example
export const workflow = createMachine({
  schemas: {
    context: types<{
      customer: Customer;
      creditCheck: {
        decision: 'Approved' | 'Denied';
      } | null;
    }>(),
    input: types<{
      customer: Customer;
    }>()
  },
  actors: {
    callCreditCheckMicroservice: createAsyncLogic({
      schemas: {
        input: types<{
          customer: Customer;
        }>()
      },
      run: ({
        input
      }): Promise<{
        id: string;
        score: number;
        decision: 'Approved' | 'Denied';
        reason: string;
      }> => {
        console.log('calling credit check microservice', input);
        return Promise.resolve({
          id: 'customer123',
          score: 700,
          decision: 'Approved' as const,
          reason: 'Good credit score'
        });
      }
    }),
    startApplicationWorkflowId: createAsyncLogic({
      schemas: {
        input: types<{
          customer: Customer;
        }>()
      },
      run: async ({ input }) => {
        console.log('starting application workflow', input);
        // fake 1s
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return {
          application: {
            id: 'application123',
            status: 'Approved'
          }
        };
      }
    }),
    sendRejectionEmailFunction: createAsyncLogic({
      schemas: {
        input: types<{
          applicant: Customer;
        }>()
      },
      run: async ({ input }) => {
        console.log('sending rejection email', input);
        // fake 1s
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return {
          email: {
            id: 'email123',
            status: 'Sent'
          }
        };
      }
    })
  },
  delays: {
    PT15M: 15 * 60 * 1000
  },
  id: 'customercreditcheck',
  initial: 'CheckCredit',
  context: ({ input }) => ({
    customer: input.customer,
    creditCheck: null
  }),
  states: {
    CheckCredit: {
      invoke: {
        src: 'callCreditCheckMicroservice',
        input: ({ context }) => ({
          customer: context.customer
        }),
        onDone: ({ context, event }) => {
          return {
            target: 'EvaluateDecision',
            context: {
              ...context,
              creditCheck: event.output
            }
          };
        }
      },
      // timeout
      after: {
        PT15M: { target: 'Timeout' }
      }
    },
    EvaluateDecision: {
      always: ({ context }) => {
        if (context.creditCheck?.decision === 'Approved') {
          return { target: 'StartApplication' };
        }
        if (context.creditCheck?.decision === 'Denied') {
          return { target: 'RejectApplication' };
        }
        return {
          target: 'RejectApplication'
        };
      }
    },
    StartApplication: {
      invoke: {
        src: 'startApplicationWorkflowId',
        input: ({ context }) => ({
          customer: context.customer
        }),
        onDone: {
          target: 'End'
        }
      }
    },
    RejectApplication: {
      invoke: {
        src: 'sendRejectionEmailFunction',
        input: ({ context }) => ({
          applicant: context.customer
        }),
        onDone: {
          target: 'End'
        }
      }
    },
    End: {
      type: 'final'
    },
    Timeout: {}
  }
});
