import { createAsyncLogic, setup, types } from 'xstate';
import {
  checkBureauService,
  checkReportsTable,
  determineMiddleScore,
  generateInterestRate,
  saveCreditProfile,
  saveCreditReport,
  userCredentialSchema,
  verifyCredentials,
  type UserCredential
} from './services/machineLogicService';
import type { BureauName, CreditProfile } from './models/creditProfile';
import type { CreditReport } from './models/creditReport';
import { z } from 'zod';

const bureauInputSchema = z.object({
  ssn: z.string(),
  bureauName: z.enum(['EquiGavin', 'GavUnion', 'Gavperian'])
});

function withScore(
  context: CreditProfile,
  bureauName: BureauName,
  creditScore: number
): CreditProfile {
  return {
    ...context,
    scores: { ...context.scores, [bureauName]: creditScore }
  };
}

function allBureausSucceeded(context: CreditProfile) {
  return Object.values(context.scores).every((score) => score > 0);
}

export const creditCheckMachine = setup({
  schemas: {
    context: types<CreditProfile>(),
    events: {
      Submit: types<{
        SSN: string;
        firstName: string;
        lastName: string;
      }>()
    }
  },
  actors: {
    verifyCredentials: createAsyncLogic({
      schemas: { input: userCredentialSchema },
      run: ({ input }) => verifyCredentials(input)
    }),
    checkReportsTable: createAsyncLogic({
      schemas: { input: bureauInputSchema },
      run: ({ input }) => checkReportsTable(input)
    }),
    checkBureau: createAsyncLogic({
      schemas: { input: bureauInputSchema },
      run: ({ input }) => checkBureauService(input)
    }),
    determineMiddleScore: createAsyncLogic({
      schemas: { input: z.array(z.number()) },
      run: async ({ input }) => determineMiddleScore(input)
    }),
    generateInterestRate: createAsyncLogic({
      schemas: { input: z.number() },
      run: ({ input }) => generateInterestRate(input)
    })
  },
  actions: {
    saveReport: (report: CreditReport) => {
      console.log('Saving report to the database...');
      void saveCreditReport(report);
    },
    saveProfile: (profile: CreditProfile) => {
      console.log('Saving the credit profile to the database...');
      void saveCreditProfile(profile);
    },
    emailUser: (params: { rates: number[] }) => {
      console.log(
        'Emailing user with their interest rate options:',
        params.rates
      );
    },
    emailSalesTeam: (profile: CreditProfile) => {
      console.log(
        "Emailing sales team with the user's information:",
        profile.FirstName,
        profile.LastName,
        profile.MiddleScore,
        profile.InterestRateOptions
      );
    }
  }
}).createMachine({
  id: 'multipleCreditCheck',
  context: {
    SSN: '',
    FirstName: '',
    LastName: '',
    scores: { EquiGavin: 0, GavUnion: 0, Gavperian: 0 },
    MiddleScore: 0,
    InterestRateOptions: [],
    ErrorMessage: ''
  },
  initial: 'enteringInformation',
  states: {
    enteringInformation: {
      on: {
        Submit: ({ context, event }) => ({
          target: 'verifyingCredentials',
          context: {
            ...context,
            SSN: event.SSN,
            FirstName: event.firstName,
            LastName: event.lastName,
            ErrorMessage: ''
          }
        })
      }
    },
    verifyingCredentials: {
      invoke: {
        src: 'verifyCredentials',
        input: ({ context }): UserCredential => ({
          SSN: context.SSN,
          firstName: context.FirstName,
          lastName: context.LastName
        }),
        onDone: { target: 'checkingCreditScores' },
        onError: ({ context, event }) => ({
          target: 'enteringInformation',
          context: {
            ...context,
            ErrorMessage: `Failed to verify credentials. Details: ${event.error}`
          }
        })
      }
    },
    checkingCreditScores: {
      description:
        'Requests a report from each of the three credit bureaus in parallel and waits for all of them.',
      type: 'parallel',
      states: {
        EquiGavin: {
          initial: 'checkingForExistingReport',
          states: {
            checkingForExistingReport: {
              invoke: {
                src: 'checkReportsTable',
                input: ({ context }) => ({
                  ssn: context.SSN,
                  bureauName: 'EquiGavin' as const
                }),
                onDone: ({ context, event }) =>
                  event.output
                    ? {
                        target: 'fetchingComplete',
                        context: withScore(
                          context,
                          'EquiGavin',
                          event.output.creditScore
                        )
                      }
                    : { target: 'fetchingReport' },
                onError: { target: 'fetchingFailed' }
              }
            },
            fetchingReport: {
              invoke: {
                src: 'checkBureau',
                input: ({ context }) => ({
                  ssn: context.SSN,
                  bureauName: 'EquiGavin' as const
                }),
                onDone: ({ context, event }) => ({
                  target: 'fetchingComplete',
                  context: withScore(context, 'EquiGavin', event.output)
                }),
                onError: { target: 'fetchingFailed' }
              }
            },
            fetchingComplete: {
              type: 'final',
              entry: ({ context, actions }, enq) => {
                enq(actions.saveReport, {
                  ssn: context.SSN,
                  bureauName: 'EquiGavin',
                  creditScore: context.scores.EquiGavin
                });
              }
            },
            fetchingFailed: { type: 'final' }
          }
        },
        GavUnion: {
          initial: 'checkingForExistingReport',
          states: {
            checkingForExistingReport: {
              invoke: {
                src: 'checkReportsTable',
                input: ({ context }) => ({
                  ssn: context.SSN,
                  bureauName: 'GavUnion' as const
                }),
                onDone: ({ context, event }) =>
                  event.output
                    ? {
                        target: 'fetchingComplete',
                        context: withScore(
                          context,
                          'GavUnion',
                          event.output.creditScore
                        )
                      }
                    : { target: 'fetchingReport' },
                onError: { target: 'fetchingFailed' }
              }
            },
            fetchingReport: {
              invoke: {
                src: 'checkBureau',
                input: ({ context }) => ({
                  ssn: context.SSN,
                  bureauName: 'GavUnion' as const
                }),
                onDone: ({ context, event }) => ({
                  target: 'fetchingComplete',
                  context: withScore(context, 'GavUnion', event.output)
                }),
                onError: { target: 'fetchingFailed' }
              }
            },
            fetchingComplete: {
              type: 'final',
              entry: ({ context, actions }, enq) => {
                enq(actions.saveReport, {
                  ssn: context.SSN,
                  bureauName: 'GavUnion',
                  creditScore: context.scores.GavUnion
                });
              }
            },
            fetchingFailed: { type: 'final' }
          }
        },
        Gavperian: {
          initial: 'checkingForExistingReport',
          states: {
            checkingForExistingReport: {
              invoke: {
                src: 'checkReportsTable',
                input: ({ context }) => ({
                  ssn: context.SSN,
                  bureauName: 'Gavperian' as const
                }),
                onDone: ({ context, event }) =>
                  event.output
                    ? {
                        target: 'fetchingComplete',
                        context: withScore(
                          context,
                          'Gavperian',
                          event.output.creditScore
                        )
                      }
                    : { target: 'fetchingReport' },
                onError: { target: 'fetchingFailed' }
              }
            },
            fetchingReport: {
              invoke: {
                src: 'checkBureau',
                input: ({ context }) => ({
                  ssn: context.SSN,
                  bureauName: 'Gavperian' as const
                }),
                onDone: ({ context, event }) => ({
                  target: 'fetchingComplete',
                  context: withScore(context, 'Gavperian', event.output)
                }),
                onError: { target: 'fetchingFailed' }
              }
            },
            fetchingComplete: {
              type: 'final',
              entry: ({ context, actions }, enq) => {
                enq(actions.saveReport, {
                  ssn: context.SSN,
                  bureauName: 'Gavperian',
                  creditScore: context.scores.Gavperian
                });
              }
            },
            fetchingFailed: { type: 'final' }
          }
        }
      },
      onDone: ({ context }) =>
        allBureausSucceeded(context)
          ? { target: 'determiningInterestRateOptions' }
          : {
              target: 'enteringInformation',
              context: {
                ...context,
                ErrorMessage: 'Failed to retrieve credit scores.'
              }
            }
    },
    determiningInterestRateOptions: {
      description:
        'Uses the middle of the three scores to decide the home loan interest rate.',
      initial: 'determiningMiddleScore',
      states: {
        determiningMiddleScore: {
          invoke: {
            src: 'determineMiddleScore',
            input: ({ context }) => Object.values(context.scores),
            onDone: ({ context, event, actions }, enq) => {
              const nextContext = { ...context, MiddleScore: event.output };
              enq(actions.saveProfile, nextContext);
              return { target: 'fetchingRates', context: nextContext };
            }
          }
        },
        fetchingRates: {
          invoke: {
            src: 'generateInterestRate',
            input: ({ context }) => context.MiddleScore,
            onDone: ({ context, event }) => ({
              target: 'ratesProvided',
              context: { ...context, InterestRateOptions: [event.output] }
            })
          }
        },
        ratesProvided: {
          type: 'final',
          entry: ({ context, actions }, enq) => {
            enq(actions.emailUser, { rates: context.InterestRateOptions });
            enq(actions.emailSalesTeam, context);
          }
        }
      }
    }
  }
});
