import { types, createMachine, createAsyncLogic } from 'xstate';
// https://github.com/serverlessworkflow/specification/tree/main/examples#finalize-college-application-example
export const workflow = createMachine({
  schemas: {
    context: types<{
      applicantId: string;
      applicationSubmitted: boolean;
      satScoresReceived: boolean;
      recommendationLetterReceived: boolean;
    }>(),
    input: types<{
      applicantId: string;
    }>()
  },
  actors: {
    finalizeApplicationFunction: createAsyncLogic({
      schemas: {
        input: types<{
          applicantId: string;
        }>()
      },
      run: async ({ input }) => {
        console.log(
          `Starting to finalize application for ${input.applicantId}`
        );
        await new Promise((resolve) => setTimeout(resolve, 1000));
        console.log('Finalized application for', input.applicantId);
        return {
          applicantId: input.applicantId
        };
      }
    })
  },
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
        ApplicationSubmitted: ({ context }) => {
          return { context: { ...context, applicationSubmitted: true } };
        },
        SATScoresReceived: ({ context }) => {
          return { context: { ...context, satScoresReceived: true } };
        },
        RecommendationLetterReceived: ({ context }) => {
          return {
            context: { ...context, recommendationLetterReceived: true }
          };
        }
      },
      always: ({ context }) => {
        if (
          !(
            context.applicationSubmitted &&
            context.satScoresReceived &&
            context.recommendationLetterReceived
          )
        ) {
          return;
        }
        return { target: 'FinalizingApplication' };
      }
    },
    FinalizingApplication: {
      invoke: {
        src: 'finalizeApplicationFunction',
        input: ({ context }) => ({
          applicantId: context.applicantId
        }),
        onDone: { target: 'Finalized' }
      }
    },
    Finalized: {
      type: 'final'
    }
  }
});
