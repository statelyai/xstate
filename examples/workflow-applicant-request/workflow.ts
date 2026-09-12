import { types, createMachine, createAsyncLogic } from 'xstate';
interface Applicant {
  fname: string;
  lname: string;
  age: number;
  email: string;
}
// https://github.com/serverlessworkflow/specification/tree/main/examples#applicant-request-decision-example
export const workflow = createMachine({
  schemas: {
    context: types<{
      applicant: Applicant;
    }>(),
    input: types<{
      applicant: Applicant;
    }>()
  },
  actors: {
    startApplicationWorkflowId: createAsyncLogic({
      run: async () => {
        console.log('startApplicationWorkflowId workflow started');
        await new Promise((resolve) => setTimeout(resolve, 1000));
        console.log('startApplicationWorkflowId workflow completed');
      }
    }),
    sendRejectionEmailFunction: createAsyncLogic({
      schemas: { input: types<{ applicant: Applicant }>() },
      run: async () => {
        console.log('sendRejectionEmailFunction workflow started');
        await new Promise((resolve) => setTimeout(resolve, 1000));
        console.log('sendRejectionEmailFunction workflow completed');
      }
    })
  },
  guards: {
    isOver18: ({ context }) => context.applicant.age >= 18
  },
  id: 'applicantrequest',
  initial: 'CheckApplication',
  context: ({ input }) => ({
    applicant: input.applicant
  }),
  states: {
    CheckApplication: {
      on: {
        Submit: (args) => {
          if (args.guards['isOver18'](args)) {
            return { target: 'StartApplication', reenter: false };
          }
          return {
            target: 'RejectApplication',
            reenter: false
          };
        }
      }
    },
    StartApplication: {
      invoke: {
        src: 'startApplicationWorkflowId',
        onDone: { target: 'End' },
        onError: { target: 'RejectApplication' }
      }
    },
    RejectApplication: {
      invoke: {
        src: 'sendRejectionEmailFunction',
        input: ({ context }) => ({
          applicant: context.applicant
        }),
        onDone: { target: 'End' }
      }
    },
    End: {
      type: 'final'
    }
  }
});
