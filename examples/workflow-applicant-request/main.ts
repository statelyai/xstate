import { createActor, fromPromise, setup } from 'xstate';

interface Applicant {
  fname: string;
  lname: string;
  age: number;
  email: string;
}

// https://github.com/serverlessworkflow/specification/tree/main/examples#applicant-request-decision-example
export const workflow = setup({
  types: {} as {
    context: {
      applicant: Applicant;
    };
    input: {
      applicant: Applicant;
    };
  },
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
  },
  guards: {
    isOver18: ({ context }) => context.applicant.age >= 18
  }
}).createMachine({
  id: 'applicantrequest',

  initial: 'CheckApplication',
  context: ({ input }) => ({
    applicant: input.applicant
  }),
  states: {
    CheckApplication: {
      on: {
        Submit: [
          {
            target: 'StartApplication',
            guard: 'isOver18',
            reenter: false
          },
          {
            target: 'RejectApplication',
            reenter: false
          }
        ]
      }
    },
    StartApplication: {
      invoke: {
        src: 'startApplicationWorkflowId',
        onDone: 'End',
        onError: 'RejectApplication'
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
});

const actor = createActor(workflow, {
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

process.stdin.on('data', (data) => {
  const eventType = data.toString().trim();
  actor.send({ type: eventType });
});
