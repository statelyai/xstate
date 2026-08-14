import { setup, types } from 'xstate';
// Actor creators are imported from the `xstate/actors` subpath so that this
// example runs under `tsx` against the workspace build.
import { createAsyncLogic } from 'xstate/actors';

export interface Applicant {
  name: string;
  country: string;
}

const wait = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Stand-ins for the two vendors a KYC desk usually calls out to. */
const verifyDocuments = createAsyncLogic({
  schemas: { input: types<{ applicant: Applicant }>() },
  run: async ({ input }) => {
    await wait(150);
    return input.applicant.name.length > 2 ? 'legible' : 'unreadable';
  }
});

const screenSanctions = createAsyncLogic({
  schemas: { input: types<{ applicant: Applicant }>() },
  run: async ({ input }) => {
    await wait(250);
    return input.applicant.country === 'XX' ? 'hit' : 'clear';
  }
});

export const kycMachine = setup({
  schemas: {
    context: types<{
      applicant: Applicant;
      documents: string | null;
      sanctions: string | null;
      question: string | null;
      decision: string | null;
    }>(),
    events: {
      approve: types<{ reviewer: string }>(),
      reject: types<{ reviewer: string; reason: string }>(),
      requestInfo: types<{ reviewer: string; question: string }>(),
      provideInfo: types<{ answer: string }>()
    },
    input: types<{ applicant: Applicant }>()
  }
}).createMachine({
  context: ({ input }) => ({
    applicant: input.applicant,
    documents: null,
    sanctions: null,
    question: null,
    decision: null
  }),
  initial: 'submitted',
  states: {
    submitted: {
      always: { target: 'automatedChecks' }
    },
    // Both vendor calls run at once; the parent leaves only when both regions
    // have reached their final state.
    automatedChecks: {
      type: 'parallel',
      states: {
        documents: {
          initial: 'checking',
          states: {
            checking: {
              invoke: {
                src: verifyDocuments,
                input: ({ context }) => ({ applicant: context.applicant }),
                onDone: ({ event }) => ({
                  target: 'checked',
                  context: { documents: event.output }
                })
              }
            },
            checked: { type: 'final' }
          }
        },
        sanctions: {
          initial: 'screening',
          states: {
            screening: {
              invoke: {
                src: screenSanctions,
                input: ({ context }) => ({ applicant: context.applicant }),
                onDone: ({ event }) => ({
                  target: 'screened',
                  context: { sanctions: event.output }
                })
              }
            },
            screened: { type: 'final' }
          }
        }
      },
      // Runs only once both regions have reached their final state.
      onDone: { target: 'manualReview' }
    },
    // The workflow parks here until a human calls one of the review endpoints.
    manualReview: {
      on: {
        approve: ({ event }) => ({
          target: 'decided',
          context: { decision: `approved by ${event.reviewer}` }
        }),
        reject: ({ event }) => ({
          target: 'decided',
          context: {
            decision: `rejected by ${event.reviewer}: ${event.reason}`
          }
        }),
        requestInfo: ({ event }) => ({
          target: 'awaitingInfo',
          context: { question: event.question }
        })
      }
    },
    awaitingInfo: {
      on: {
        provideInfo: ({ context, event }) => ({
          target: 'manualReview',
          context: {
            question: null,
            documents: `${context.documents} (+ ${event.answer})`
          }
        })
      }
    },
    decided: {
      type: 'final',
      output: ({ context }) => ({
        applicant: context.applicant.name,
        decision: context.decision,
        documents: context.documents,
        sanctions: context.sanctions
      })
    }
  }
});
