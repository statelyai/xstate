import { assign, fromPromise, createActor, setup } from 'xstate';

// https://github.com/serverlessworkflow/specification/tree/main/examples#finalize-college-application-example
export const workflow = setup({
  types: {
    context: {} as {
      applicantId: string;
      applicationSubmitted: boolean;
      satScoresReceived: boolean;
      recommendationLetterReceived: boolean;
    },
    input: {} as {
      applicantId: string;
    }
  },
  actors: {
    finalizeApplicationFunction: fromPromise(
      async ({ input }: { input: { applicantId: string } }) => {
        console.log(
          `Starting to finalize application for ${input.applicantId}`
        );

        await new Promise((resolve) => setTimeout(resolve, 1000));
        console.log('Finalized application for', input.applicantId);

        return {
          applicantId: input.applicantId
        };
      }
    )
  }
}).createMachine({
  id: 'finalizeCollegeApplication',
  context: ({ input }) => ({
    applicantId: input.applicantId,
    applicationSubmitted: false,
    satScoresReceived: false,
    recommendationLetterReceived: false
  }),
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
        src: 'finalizeApplicationFunction',
        input: ({ context }) => ({
          applicantId: context.applicantId
        }),
        onDone: 'Finalized'
      }
    },
    Finalized: {
      type: 'final'
    }
  }
});

const actor = createActor(workflow, {
  input: {
    applicantId: '123'
  }
});

actor.subscribe({
  next(state) {
    console.log(state.value);
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
