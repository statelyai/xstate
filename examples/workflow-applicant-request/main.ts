import { createMachine, fromPromise, interpret } from 'xstate';

// https://github.com/serverlessworkflow/specification/tree/main/examples#applicant-request-decision-example
export const workflow = createMachine(
  {
    id: 'applicantrequest',
    types: {} as {
      context: {
        applicant: {
          fname: string;
          lname: string;
          age: number;
          email: string;
        };
      };
    },
    initial: 'CheckApplication',
    context: ({ input }) => ({
      applicant: input.applicant
    }),
    states: {
      CheckApplication: {
        always: [
          {
            guard: ({ context }) => context.applicant.age >= 18,
            target: 'StartApplication'
          },
          {
            target: 'RejectApplication'
          }
        ]
      },
      StartApplication: {
        invoke: {
          src: 'startApplicationWorkflowId',
          onDone: 'End'
        }
      },
      RejectApplication: {
        invoke: {
          src: 'sendRejectionEmailFunction',
          input: ({ context }) => ({
            applicant: context.applicant
          }),
          onDone: 'End'
        }
      },
      End: {
        type: 'final'
      }
    }
  },
  {
    actors: {
      startApplicationWorkflowId: fromPromise(async () => {
        console.log('startApplicationWorkflowId workflow started');

        await new Promise((resolve) => setTimeout(resolve, 1000));
        console.log('startApplicationWorkflowId workflow completed');
      }),
      sendRejectionEmailFunction: fromPromise(async () => {
        console.log('sendRejectionEmailFunction workflow started');

        await new Promise((resolve) => setTimeout(resolve, 1000));
        console.log('sendRejectionEmailFunction workflow completed');
      })
    }
  }
);

const actor = interpret(workflow, {
  input: {
    applicant: {
      fname: 'John',
      lname: 'Stockton',
      age: 22,
      email: 'js@something.com'
    }
  }
});

actor.subscribe({
  complete() {
    console.log('workflow completed', actor.getSnapshot().output);
  }
});

actor.start();
