import { createMachine, createAsyncLogic, createActor } from 'xstate';
import { z } from 'zod';
// https://github.com/serverlessworkflow/specification/tree/main/examples#finalize-college-application-example
export const workflow = createMachine({
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
  actorSources: {
    finalizeApplicationFunction: createAsyncLogic({
      schemas: {
        input: z.custom<{
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
        ApplicationSubmitted: ({ context, event, guards, actions }, enq) => {
          return { context: { ...context, applicationSubmitted: true } };
        },
        SATScoresReceived: ({ context, event, guards, actions }, enq) => {
          return { context: { ...context, satScoresReceived: true } };
        },
        RecommendationLetterReceived: (
          { context, event, guards, actions },
          enq
        ) => {
          return {
            context: { ...context, recommendationLetterReceived: true }
          };
        }
      },
      always: ({ context, event, guards, actions }, enq) => {
        if (
          !(({ context }) =>
            context.applicationSubmitted &&
            context.satScoresReceived &&
            context.recommendationLetterReceived)({ context, event })
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
