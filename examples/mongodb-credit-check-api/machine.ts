import { createMachine, createAsyncLogic } from 'xstate';
import { z } from 'zod';
import {
  checkBureauService,
  checkReportsTable,
  determineMiddleScore,
  generateInterestRate,
  saveCreditProfile,
  saveCreditReport,
  verifyCredentials,
  type userCredential
} from './services/machineLogicService';
import type CreditProfile from './models/creditProfile';

type BureauInput = { ssn: string; bureauName: string };

export const creditCheckMachine = createMachine({
  schemas: {
    context: z.custom<CreditProfile>(),
    events: {
      Submit: z.object({
        SSN: z.string(),
        firstName: z.string(),
        lastName: z.string()
      })
    }
  },
  actors: {
    verifyCredentials: createAsyncLogic({
      schemas: { input: z.custom<userCredential>() },
      run: ({ input }) => verifyCredentials(input)
    }),
    checkReportsTable: createAsyncLogic({
      schemas: { input: z.custom<BureauInput>() },
      run: ({ input }) => checkReportsTable(input)
    }),
    checkBureau: createAsyncLogic({
      schemas: { input: z.custom<BureauInput>() },
      run: async ({ input }) => {
        const creditScore = await checkBureauService(input);
        await saveCreditReport({ ...input, creditScore });
        return creditScore;
      }
    }),
    determineMiddleScore: createAsyncLogic({
      schemas: { input: z.custom<number[]>() },
      run: ({ input }) => determineMiddleScore(input)
    }),
    generateInterestRates: createAsyncLogic({
      schemas: { input: z.custom<CreditProfile>() },
      run: async ({ input }) => {
        const rate = await generateInterestRate(input.MiddleScore);
        await saveCreditProfile({ ...input, InterestRateOptions: [rate] });
        return rate;
      }
    })
  },
  context: {
    SSN: '',
    FirstName: '',
    LastName: '',
    GavUnionScore: 0,
    EquiGavinScore: 0,
    GavperianScore: 0,
    ErrorMessage: '',
    MiddleScore: 0,
    InterestRateOptions: []
  },
  id: 'multipleCreditCheck',
  initial: 'creditCheck',
  states: {
    Completed: { type: 'final' },
    creditCheck: {
      initial: 'Entering Information',
      states: {
        'Entering Information': {
          on: {
            Submit: ({ context, event }) => ({
              target: 'Verifying Credentials',
              context: {
                ...context,
                SSN: event.SSN,
                FirstName: event.firstName,
                LastName: event.lastName,
                ErrorMessage: '',
                GavUnionScore: 0,
                EquiGavinScore: 0,
                GavperianScore: 0,
                MiddleScore: 0,
                InterestRateOptions: []
              }
            })
          }
        },
        'Verifying Credentials': {
          invoke: {
            src: 'verifyCredentials',
            input: ({ context }) => ({
              SSN: context.SSN,
              firstName: context.FirstName,
              lastName: context.LastName
            }),
            onDone: { target: 'CheckingCreditScores' },
            onError: ({ context, event }) => ({
              target: 'Entering Information',
              context: {
                ...context,
                ErrorMessage:
                  'Failed to verify credentials. Details: ' +
                  String(event.error)
              }
            })
          }
        },
        CheckingCreditScores: {
          type: 'parallel',
          states: {
            CheckingEquiGavin: {
              initial: 'CheckingForExistingReport',
              states: {
                CheckingForExistingReport: {
                  invoke: {
                    src: 'checkReportsTable',
                    input: ({ context }) => ({
                      ssn: context.SSN,
                      bureauName: 'EquiGavin'
                    }),
                    onDone: ({ context, event }) =>
                      event.output && event.output.creditScore > 0
                        ? {
                            target: 'FetchingComplete',
                            context: {
                              ...context,
                              EquiGavinScore: event.output.creditScore
                            }
                          }
                        : { target: 'FetchingReport' },
                    onError: { target: 'FetchingFailed' }
                  }
                },
                FetchingReport: {
                  invoke: {
                    src: 'checkBureau',
                    input: ({ context }) => ({
                      ssn: context.SSN,
                      bureauName: 'EquiGavin'
                    }),
                    onDone: ({ context, event }) => ({
                      target: 'FetchingComplete',
                      context: { ...context, EquiGavinScore: event.output }
                    }),
                    onError: { target: 'FetchingFailed' }
                  }
                },
                FetchingComplete: { type: 'final' },
                FetchingFailed: { type: 'final' }
              }
            },
            CheckingGavUnion: {
              initial: 'CheckingForExistingReport',
              states: {
                CheckingForExistingReport: {
                  invoke: {
                    src: 'checkReportsTable',
                    input: ({ context }) => ({
                      ssn: context.SSN,
                      bureauName: 'GavUnion'
                    }),
                    onDone: ({ context, event }) =>
                      event.output && event.output.creditScore > 0
                        ? {
                            target: 'FetchingComplete',
                            context: {
                              ...context,
                              GavUnionScore: event.output.creditScore
                            }
                          }
                        : { target: 'FetchingReport' },
                    onError: { target: 'FetchingFailed' }
                  }
                },
                FetchingReport: {
                  invoke: {
                    src: 'checkBureau',
                    input: ({ context }) => ({
                      ssn: context.SSN,
                      bureauName: 'GavUnion'
                    }),
                    onDone: ({ context, event }) => ({
                      target: 'FetchingComplete',
                      context: { ...context, GavUnionScore: event.output }
                    }),
                    onError: { target: 'FetchingFailed' }
                  }
                },
                FetchingComplete: { type: 'final' },
                FetchingFailed: { type: 'final' }
              }
            },
            CheckingGavperian: {
              initial: 'CheckingForExistingReport',
              states: {
                CheckingForExistingReport: {
                  invoke: {
                    src: 'checkReportsTable',
                    input: ({ context }) => ({
                      ssn: context.SSN,
                      bureauName: 'Gavperian'
                    }),
                    onDone: ({ context, event }) =>
                      event.output && event.output.creditScore > 0
                        ? {
                            target: 'FetchingComplete',
                            context: {
                              ...context,
                              GavperianScore: event.output.creditScore
                            }
                          }
                        : { target: 'FetchingReport' },
                    onError: { target: 'FetchingFailed' }
                  }
                },
                FetchingReport: {
                  invoke: {
                    src: 'checkBureau',
                    input: ({ context }) => ({
                      ssn: context.SSN,
                      bureauName: 'Gavperian'
                    }),
                    onDone: ({ context, event }) => ({
                      target: 'FetchingComplete',
                      context: { ...context, GavperianScore: event.output }
                    }),
                    onError: { target: 'FetchingFailed' }
                  }
                },
                FetchingComplete: { type: 'final' },
                FetchingFailed: { type: 'final' }
              }
            }
          },
          onDone: ({ context }) =>
            context.EquiGavinScore > 0 &&
            context.GavUnionScore > 0 &&
            context.GavperianScore > 0
              ? { target: 'DeterminingInterestRateOptions' }
              : {
                  target: 'Entering Information',
                  context: {
                    ...context,
                    ErrorMessage: 'Failed to retrieve credit scores.'
                  }
                }
        },
        DeterminingInterestRateOptions: {
          onDone: { target: '#multipleCreditCheck.Completed' },
          initial: 'DeterminingMiddleScore',
          states: {
            DeterminingMiddleScore: {
              invoke: {
                src: 'determineMiddleScore',
                input: ({ context }) => [
                  context.EquiGavinScore,
                  context.GavUnionScore,
                  context.GavperianScore
                ],
                onDone: ({ context, event }) => ({
                  target: 'FetchingRates',
                  context: { ...context, MiddleScore: event.output }
                }),
                onError: ({ context, event }) => ({
                  target:
                    '#multipleCreditCheck.creditCheck.Entering Information',
                  context: { ...context, ErrorMessage: String(event.error) }
                })
              }
            },
            FetchingRates: {
              invoke: {
                src: 'generateInterestRates',
                input: ({ context }) => context,
                onDone: ({ context, event }) => ({
                  target: 'RatesProvided',
                  context: { ...context, InterestRateOptions: [event.output] }
                }),
                onError: ({ context, event }) => ({
                  target:
                    '#multipleCreditCheck.creditCheck.Entering Information',
                  context: { ...context, ErrorMessage: String(event.error) }
                })
              }
            },
            RatesProvided: {
              type: 'final',
              entry: ({ context }, enq) => {
                enq(() =>
                  console.log(
                    'emailing user with their interest rate options:',
                    context.InterestRateOptions
                  )
                );
                enq(() =>
                  console.log(
                    'emailing sales team with the user information:',
                    context.FirstName,
                    context.LastName,
                    context.InterestRateOptions,
                    context.MiddleScore
                  )
                );
              }
            }
          }
        }
      }
    }
  }
});
