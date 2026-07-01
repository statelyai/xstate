import { createMachine, createAsyncLogic } from "xstate";
import {
  checkBureauService,
  checkReportsTable,
  determineMiddleScore,
  generateInterestRate,
  saveCreditProfile,
  saveCreditReport,
  userCredential,
  verifyCredentials,
} from "./services/machineLogicService";
import CreditProfile from "./models/creditProfile";
import { z } from "zod";
export const creditCheckMachine = createMachine({
  types: {
    events: {} as {
      type: "Submit";
      SSN: string;
      lastName: string;
      firstName: string;
    },
    context: {} as CreditProfile,
  },
  actorSources: {
    checkBureau: createAsyncLogic({
      schemas: {
        input: z.custom<{
          ssn: string;
          bureauName: string;
        }>(),
      },
      run: async ({ input }) => await checkBureauService(input),
    }),
    checkReportsTable: createAsyncLogic({
      schemas: {
        input: z.custom<{
          ssn: string;
          bureauName: string;
        }>(),
      },
      run: async ({ input }) => await checkReportsTable(input),
    }),
    verifyCredentials: createAsyncLogic({
      schemas: {
        input: z.custom<userCredential>(),
      },
      run: async ({ input }) => await verifyCredentials(input),
    }),
    determineMiddleScore: createAsyncLogic({
      schemas: {
        input: z.custom<number[]>(),
      },
      run: async ({ input }) => await determineMiddleScore(input),
    }),
    generateInterestRates: createAsyncLogic({
      schemas: {
        input: z.custom<number>(),
      },
      run: async ({ input }) => await generateInterestRate(input),
    }),
  },
  actions: {
    saveReport: (
      {
        context,
      }: {
        context: CreditProfile;
      },
      params: {
        bureauName: string;
      },
    ) => {
      console.log("saving report to the database...");
      saveCreditReport({
        ssn: context.SSN,
        bureauName: params.bureauName,
        creditScore: context.EquiGavinScore,
      });
    },
    emailUser: function ({ context }) {
      console.log(
        "emailing user with their interest rate options: ",
        context.InterestRateOptions,
      );
    },
    saveCreditProfile: async function ({ context }) {
      console.log("saving results to the database...");
      await saveCreditProfile(context);
    },
    emailSalesTeam: function ({ context, event }, params) {
      console.log(
        'emailing sales team with the user"s information: ',
        context.FirstName,
        context.LastName,
        context.InterestRateOptions,
        context.MiddleScore,
      );
    },
  },
  guards: {
    allSucceeded: ({ context }) => {
      console.log("allSucceeded guard called");
      return (
        context.EquiGavinScore > 0 &&
        context.GavUnionScore > 0 &&
        context.GavperianScore > 0
      );
    },
    gavUnionReportFound: ({ context }) => {
      return context.GavUnionScore > 0;
    },
    equiGavinReportFound: ({ context }) => {
      return context.EquiGavinScore > 0;
    },
    gavperianReportFound: ({ context }) => {
      return context.GavperianScore > 0;
    },
  },
  context: {
    SSN: "",
    FirstName: "",
    LastName: "",
    GavUnionScore: 0,
    EquiGavinScore: 0,
    GavperianScore: 0,
    ErrorMessage: "",
    MiddleScore: 0,
    InterestRateOptions: [],
  },
  id: "multipleCreditCheck",
  initial: "creditCheck",
  states: {
    creditCheck: {
      initial: "Entering Information",
      states: {
        "Entering Information": {
          on: {
            Submit: {
              target: "Verifying Credentials",
              reenter: true,
            },
          },
        },
        "Verifying Credentials": {
          invoke: {
            input: ({ event }) => event,
            src: "verifyCredentials",
            onDone: ({ context, event, guards, actions }, enq) => {
              return {
                target: "CheckingCreditScores",
                context: {
                  ...context,
                  SSN: (({ event }) => event.output.SSN)({
                    context: context,
                    event: event,
                  }),
                  FirstName: (({ event }) => event.output.firstName)({
                    context: context,
                    event: event,
                  }),
                  LastName: (({ event }) => event.output.lastName)({
                    context: context,
                    event: event,
                  }),
                },
              };
            },
            onError: [
              ({ context, event, guards, actions }, enq) => {
                return {
                  target: "Entering Information",
                  context: {
                    ...context,
                    ErrorMessage: (({
                      event,
                    }: {
                      context: any;
                      event: {
                        error: any;
                      };
                    }) =>
                      "Failed to verify credentials. Details: " + event.error)({
                      context: context,
                      event: event,
                    }),
                  },
                };
              },
            ],
          },
        },
        CheckingCreditScores: {
          description:
            "Kick off a series of requests to the 3 American Credit Bureaus and await their results",
          states: {
            CheckingEquiGavin: {
              initial: "CheckingForExistingReport",
              states: {
                CheckingForExistingReport: {
                  invoke: {
                    input: ({ context: { SSN } }) => ({
                      bureauName: "EquiGavin",
                      ssn: SSN,
                    }),
                    src: "checkReportsTable",
                    id: "equiGavinDBActor",
                    onDone: [
                      ({ context, event, guards, actions }, enq) => {
                        if (
                          !guards["equiGavinReportFound"]({ context, event })
                        ) {
                          return;
                        }
                        return {
                          target: "FetchingComplete",
                          context: {
                            ...context,
                            EquiGavinScore: (({ event }) =>
                              event.output?.creditScore ?? 0)({
                              context: context,
                              event: event,
                            }),
                          },
                        };
                      },
                      {
                        target: "FetchingReport",
                      },
                    ],
                    onError: [
                      {
                        target: "FetchingFailed",
                      },
                    ],
                  },
                },
                FetchingComplete: {
                  type: "final",
                  entry: (args, enq) => {
                    enq(args.actions["saveReport"], {
                      bureauName: "EquiGavin",
                    });
                  },
                },
                FetchingReport: {
                  invoke: {
                    input: ({ context: { SSN } }) => ({
                      bureauName: "EquiGavin",
                      ssn: SSN,
                    }),
                    src: "checkBureau",
                    id: "equiGavinFetchActor",
                    onDone: [
                      ({ context, event, guards, actions }, enq) => {
                        return {
                          target: "FetchingComplete",
                          context: {
                            ...context,
                            EquiGavinScore: (({ event }) => event.output ?? 0)({
                              context: context,
                              event: event,
                            }),
                          },
                        };
                      },
                    ],
                    onError: [
                      {
                        target: "FetchingFailed",
                      },
                    ],
                  },
                },
                FetchingFailed: {
                  type: "final",
                },
              },
            },
            CheckingGavUnion: {
              initial: "CheckingForExistingReport",
              states: {
                CheckingForExistingReport: {
                  invoke: {
                    input: ({ context: { SSN } }) => ({
                      bureauName: "GavUnion",
                      ssn: SSN,
                    }),
                    src: "checkReportsTable",
                    id: "gavUnionDBActor",
                    onDone: [
                      ({ context, event, guards, actions }, enq) => {
                        if (
                          !guards["gavUnionReportFound"]({ context, event })
                        ) {
                          return;
                        }
                        return {
                          target: "FetchingComplete",
                          context: {
                            ...context,
                            GavUnionScore: (({ event }) =>
                              event.output?.creditScore ?? 0)({
                              context: context,
                              event: event,
                            }),
                          },
                        };
                      },
                      {
                        target: "FetchingReport",
                      },
                    ],
                    onError: [
                      {
                        target: "FetchingFailed",
                      },
                    ],
                  },
                },
                FetchingComplete: {
                  type: "final",
                  entry: (args, enq) => {
                    enq(args.actions["saveReport"], {
                      bureauName: "GavUnion",
                    });
                  },
                },
                FetchingReport: {
                  invoke: {
                    input: ({ context: { SSN } }) => ({
                      bureauName: "GavUnion",
                      ssn: SSN,
                    }),
                    src: "checkBureau",
                    id: "gavUnionFetchActor",
                    onDone: [
                      ({ context, event, guards, actions }, enq) => {
                        return {
                          target: "FetchingComplete",
                          context: {
                            ...context,
                            GavUnionScore: (({ event }) => event.output ?? 0)({
                              context: context,
                              event: event,
                            }),
                          },
                        };
                      },
                    ],
                    onError: [
                      {
                        target: "FetchingFailed",
                      },
                    ],
                  },
                },
                FetchingFailed: {
                  type: "final",
                },
              },
            },
            CheckingGavperian: {
              initial: "CheckingForExistingReport",
              states: {
                CheckingForExistingReport: {
                  invoke: {
                    input: ({ context: { SSN } }) => ({
                      bureauName: "Gavperian",
                      ssn: SSN,
                    }),
                    src: "checkReportsTable",
                    id: "gavperianCheckActor",
                    onDone: [
                      ({ context, event, guards, actions }, enq) => {
                        if (
                          !guards["gavperianReportFound"]({ context, event })
                        ) {
                          return;
                        }
                        return {
                          target: "FetchingComplete",
                          context: {
                            ...context,
                            GavperianScore: (({ event }) =>
                              event.output?.creditScore ?? 0)({
                              context: context,
                              event: event,
                            }),
                          },
                        };
                      },
                      {
                        target: "FetchingReport",
                      },
                    ],
                    onError: [
                      {
                        target: "FetchingFailed",
                      },
                    ],
                  },
                },
                FetchingComplete: {
                  type: "final",
                  entry: (args, enq) => {
                    enq(args.actions["saveReport"], {
                      bureauName: "Gavperian",
                    });
                  },
                },
                FetchingReport: {
                  invoke: {
                    input: ({ context: { SSN } }) => ({
                      ssn: SSN,
                      bureauName: "Gavperian",
                    }),
                    src: "checkBureau",
                    id: "checkGavPerianActor",
                    onDone: [
                      ({ context, event, guards, actions }, enq) => {
                        return {
                          target: "FetchingComplete",
                          context: {
                            ...context,
                            GavperianScore: (({ event }) => event.output ?? 0)({
                              context: context,
                              event: event,
                            }),
                          },
                        };
                      },
                    ],
                    onError: [
                      {
                        target: "FetchingFailed",
                      },
                    ],
                  },
                },
                FetchingFailed: {
                  type: "final",
                },
              },
            },
          },
          type: "parallel",
          onDone: [
            ({ context, event, guards, actions }, enq) => {
              if (!guards["allSucceeded"]({ context, event })) {
                return;
              }
              return {
                target: "DeterminingInterestRateOptions",
                reenter: true,
              };
            },
            ({ context, event, guards, actions }, enq) => {
              return {
                target: "Entering Information",
                context: {
                  ...context,
                  ErrorMessage: (({ context }) =>
                    "Failed to retrieve credit scores.")({
                    context: context,
                    event: event,
                  }),
                },
              };
            },
          ],
        },
        DeterminingInterestRateOptions: {
          description:
            "After retrieving results, determine the middle score to be used in home loan interest rate decision",
          initial: "DeterminingMiddleScore",
          states: {
            DeterminingMiddleScore: {
              invoke: {
                input: ({
                  context: { EquiGavinScore, GavUnionScore, GavperianScore },
                }) => [EquiGavinScore, GavUnionScore, GavperianScore],
                src: "determineMiddleScore",
                id: "scoreDeterminationActor",
                onDone: [
                  ({ context, event, guards, actions }, enq) => {
                    enq((actionArgs) =>
                      actions["saveCreditProfile"](actionArgs as any),
                    );
                    return {
                      target: "FetchingRates",
                      context: {
                        ...context,
                        MiddleScore: (({ event }) => event.output)({
                          context: context,
                          event: event,
                        }),
                      },
                    };
                  },
                ],
              },
            },
            FetchingRates: {
              invoke: {
                input: ({ context: { MiddleScore } }) => MiddleScore,
                src: "generateInterestRates",
                onDone: [
                  ({ context, event, guards, actions }, enq) => {
                    return {
                      target: "RatesProvided",
                      context: {
                        ...context,
                        InterestRateOptions: (({ event }) => [event.output])({
                          context: context,
                          event: event,
                        }),
                      },
                    };
                  },
                ],
              },
            },
            RatesProvided: {
              entry: (args, enq) => {
                enq((actionArgs) =>
                  args.actions["emailUser"](actionArgs as any),
                );
                enq((actionArgs) =>
                  args.actions["emailSalesTeam"](actionArgs as any),
                );
              },
              type: "final",
            },
          },
        },
      },
    },
  },
});
