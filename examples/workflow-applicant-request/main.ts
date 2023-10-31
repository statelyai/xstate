import { createActor, createMachine, fromPromise } from 'xstate';

interface Applicant {
  fname: string;
  lname: string;
  age: number;
  email: string;
}

// https://github.com/serverlessworkflow/specification/tree/main/examples#applicant-request-decision-example
export const workflow = createMachine(
  {
    /** @xstate-layout N4IgpgJg5mDOIC5QEMAOqA2BLAxsgdgC4BOYAjgK5yEB0AwgBZg4DWAgutnoVgPb4BiAMoUARgFsshANoAGALqJQqXrCl98SkAA9EAdgAcNACwBGAMzGAnADYArMYBMj+8bsAaEAE9E55zVljM2MbPWM9cwjTAF9ozzRMXAIScipYWkZmdk4knn5hMUkZU0UkEBU1PM0y3QRzUxMrOzsXKysDPQc3PU8fBBCGqyCbNqtzcytTA0tY+Jy8IlJKahohQmRiQg5E7g0BCH4wGix8ADdeFiOErmSltNo1ja355CqEE-Pd-jl5H60K9T8LS1EYNWSdaymRyBeymKy9RCOUwNcwGMamMx6GxmUwtWYga5JRapFaPTbbG5VARgYjEXjEGiYV4AM3p4hohIWKWW6VW63JLzeH14X3wPz+ZQBVWBiFsehoIys0OmsgMqrcCIQNnMNFx4RcBmsBjspk6dnxnNuJN5ACUwAArZjPHavPYHfBHYWXDkvYk82h2x04Z2UjTvM4i13fBQS5SqQHVUAgyYBCGTaEhE3w7yIUyyGyp2TmcH2NHGiaxOIgfC8CBwLSWv33f7x6U1RAAWlMBbsgXCxdkULcDnMmo7jmMNEsLT0ZoxjlnVgtvu593oTFYFNyGhblR37f6jk1yIauMczRsC9Rtmxy5dTdJ-JD26Bktb+6TiDsekcNFaLVVQDDQ8HMEEcAwGixEZnHMGxDWMWRHDvG4H1tB0nS3UVdwTGUEG-At2hGODJng79NWMPwpxGPQrD0KZBzhJCq0bVcVgAUXwCBsLbT8EFo39wOxCdtWcNFj2RXUHB-OCjRNLFK2iIA */
    id: 'applicantrequest',
    types: {} as {
      context: {
        applicant: Applicant;
      };
      input: {
        applicant: Applicant;
      };
    },
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
    },
    guards: {
      isOver18: ({ context }) => context.applicant.age >= 18
    }
  }
);

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
