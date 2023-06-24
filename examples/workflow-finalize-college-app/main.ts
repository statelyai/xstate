import { assign, createMachine, fromPromise, interpret } from 'xstate';

// https://github.com/serverlessworkflow/specification/tree/main/examples#finalize-college-application-example
export const workflow = createMachine(
  {
    id: 'finalizeCollegeApplication',
    context: {
      applicantId: '',
      applicationSubmitted: false,
      satScoresReceived: false,
      recommendationLetterReceived: false
    },
    initial: 'FinalizeApplication',
    states: {
      FinalizeApplication: {
        on: {
          ApplicationSubmitted: {
            actions: assign({
              applicationSubmitted: true
            })
          },
          SATScoresReceived: {
            actions: assign({
              satScoresReceived: true
            })
          },
          RecommendationLetterReceived: {
            actions: assign({
              recommendationLetterReceived: true
            })
          }
        },
        always: {
          guard: ({ context }) =>
            context.applicationSubmitted &&
            context.satScoresReceived &&
            context.recommendationLetterReceived,
          target: 'FinalizingApplication'
        }
      },
      FinalizingApplication: {
        invoke: {
          src: 'finalizeApplicationFunction'
          // onDone: 'Finalized'
        }
      },
      Finalized: {
        type: 'final'
      }
    }
  },
  {
    actors: {
      finalizeApplicationFunction: fromPromise(async ({ input }) => {
        console.log(
          `Starting to finalize application for ${input.applicantId}`
        );

        await new Promise((resolve) => setTimeout(resolve, 1000));
        console.log('Finalized application for', input.applicantId);

        return {
          applicantId: input.applicantId
        };
      })
    }
  }
);

const actor = interpret(workflow, {
  input: {
    applicantId: '123'
  }
});

actor.subscribe({
  next(state) {
    console.log('Received event', state.event, state.value);
  },
  complete() {
    console.log('workflow completed', actor.getSnapshot().output);
  }
});

actor.start();

// delay 1000
await new Promise((resolve) => setTimeout(resolve, 1000));

actor.send({
  type: 'ApplicationSubmitted'
});

// delay 1000
await new Promise((resolve) => setTimeout(resolve, 1000));

actor.send({
  type: 'SATScoresReceived'
});

// delay 1000
await new Promise((resolve) => setTimeout(resolve, 1000));

actor.send({
  type: 'RecommendationLetterReceived'
});
