import { fromPromise, assign, setup } from "xstate";
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

export const creditCheckMachine = setup({
  types: {
    events: {} as {
      type: "Submit";
      SSN: string;
      lastName: string;
      firstName: string;
    },
    context: {} as CreditProfile,
  },

  actors: {
    checkBureau: fromPromise(
      async ({ input }: { input: { ssn: string; bureauName: string } }) =>
        await checkBureauService(input),
    ),
    checkReportsTable: fromPromise(
      async ({ input }: { input: { ssn: string; bureauName: string } }) =>
        await checkReportsTable(input),
    ),
    verifyCredentials: fromPromise(
      async ({ input }: { input: userCredential }) =>
        await verifyCredentials(input),
    ),
    determineMiddleScore: fromPromise(
      async ({ input }: { input: number[] }) =>
        await determineMiddleScore(input),
    ),
    generateInterestRates: fromPromise(
      async ({ input }: { input: number }) => await generateInterestRate(input),
    ),
  },
  actions: {
    saveReport: (
      { context }: { context: CreditProfile },
      params: { bureauName: string },
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
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QFsCuAbALgSwA7rAGEAnSbTQgCzAGMBrAOhtInKtsYFEA7TMY7NygACAJLcAZgHtiyAIY4p3AMQBlVACNk5ANoAGALqJQuKbHLYlxkAA9EAZgAcAVgYB2ACwAmAIyO3zgA0IACeiD5ueu4AbM7RXs4AvonBaFh4BCRkFNT0TCxsuYwAavzYEiGCIlkQYLzYcuiwyhBKYAyCAG5SdO1pOPhEBTkc+dnseaUCFVXCNXU4jbAIXVI0Cpbc+gbb1qbmitzWdggAnB6u0Y72zqf2AcFhCAC0jgz20W5+AcmpGAOZYYTRjMcZFBhTcqVIRzFgLBpNZT8YgyBj4BTSWQMfoZIZg0ag1gjSZlGYw+b1JYrbjddaHba7JAgfYWKxMk56R6IPS-EA4wY1QoEoHg4FVQWYVQ0GRwFptBiwTAKPr-XES4FjIkasVCCVSmWwRkmMyso7sxBeDz+BgeU7OG56DwePTOZwuLkIa7RBiOFynPT2QNuaL2U6OXn8wH4vKEoV5HVQPXS0jNVrcdqK5XY1UCkXC6OMBNJg06HxGJksw7HRDOHyuV1uG5W+zeU5XD3PW7vRweOsfU5tl1eU4RnNRrXg2PEwtFcXDfUphgJzgAR1Q2AA4nJOoIl7OhAAxGScGzYRVVABKYFMxEwcvTHRpPXaYDXm+3ggAIgAhACCNEwGQjWZE0q3NBAAlOd5-ViV1HS8LxfQ9HxELeFDLRuAdh1ONxR3SXMC01OMZw4OdsgXOA91IoRV3XLcd24Kj6CqI9iBPM8cCEK8bzvNN2lWXoGFfOiP24H9-0A4hS3LY0Dk2asIK7UM9Fg5x4NQ5CnSieIMNuU5sNwlI+THPEJ3zMz433RN52TSjlzfejdwTVj2PPLjrxkO9kVRdFMExZAhIc0TxIAoDDD2UD5PAyDoJU101O8DTQnCN17HeNxdKwgdDL+fDx2IojpyYugyKJCjYGKqpaPfBiGAPMBMBoShLw829734p9BOEmrBHqxrKAksKZJAuS2VAE4fCtKDPjdHwUMiBJJs0vQvAYe1nC8Nw3EcaIZuiDw8IBUyCqnbUrOLRd7JE2q+qalqeKRYgUWINF0AxGQAu6xzuFugbQqk8KK0isbbHCW0ohbewfCh2s5r0O1NNdNaPltHtHEtbxDrVPMYxxkjmN1GyDUqoR6IAVW4TYSagFzTzcqBuM89rH26QSoG3CnNhCyTgMrKLxsQAJvUiOJfT0Rw9BW3bkO2nx3hbW5+y8PRIhy4y8uOorTtFc6icuqzycppRqdpjj7qZviWefBh2c6TmlG5oCywi0azQFxThZdK4JYlqXomQu40uuC47mifSVZVrGCIskE8epi67INjmjcY5zjzpziGdarynp8t6-I+m3k65v9-t54G3dBj33C9sXfa8aXkoQZXgzWntFbDluXSj-Ktbjos9cT6ioENqnfvNtrLYE9pbftn6GqawaAeGvmQYmjxYgYBJlLiHxznOf2m78AcGD37bPDbXs5pHIzI01jVtdGAfyNsiqE1H43x-ch7vJe3z-KLnbFOv0l7l1dgpSam99LoTdNEAMG03AB1tO4VWalHCnD8PYS0Pd76Tn7rrF+xN37blwGUOQqcrKm3pozSe8pp6ANIQIchwJQGA1kqaBS20oiug3v4eG4tQwem2q4S0-hMG+nQc4NWd91R4MIs-Mqr9qb0UYQ0Chw8qGZxobxOhnUZ4kLIdwFhZdnZA3AdFCWa1nC8MiP6a4pwPR3DcO4K0XxrgSLtNIkysjzIFQUeQcqyiDFMPUQTGm6czbfyZr-V670sS21UcwoorCV4VwgXFNaXgnBOhmr2QMyE6zOPiNECI-oAjeGhjgnxuN5EEMUUQpOnREmMS-lnB6U89FMCKPRAACoYlJLsOHgTrI6U+bg2x8LsYIpu-oPA2jDG4pwvpPFVLjo-Syw8E5v0ac0uqC9mpRLajE-+hcmocF6f0subCRpDPdiMuZpSri2IEQ4mZtYGADjEe45ZUjVmEXWYwT8DV+DaEpkIcQfAUyYAvMqAA8rgQ4FUgWQtBVUAAstgCAEACAUWZvQ6ezwNAQAAFboGQGA25VcsGfAYGHXaiE9BzSuIfJ4O1XCSycbA-wO1oh-JjoVDUyKQWCCqBC-gcBoVwoRZsCqrSYV8FTLo1mKoNbVNjoRIVsgRXgt4OKxU8qwDwsRXs-ql5lTLFWHSTYDJrmr0rice4e9aURBcC2HCGMPS+mcY2DwgYslSIQjcZIRluBSFqPAJkMi8aDLAu7Z4bYOxZLmdkvsYdBz2j5SdaNZjKUnGeFaDskCfQ9lTQOOBGbb7eLWXHHgkLZjiH8hsEGdrOFpRDIhFCQQj5dniEkStqrq2EUhGSaocJKRNBjfzKuJTvX2hgpNHw8CPAehuM450torQR0DLaTNfdambMHhG9hsaq4dvlk4JNYdbj+o9NY70ojFkeN+f2o6aqBU6wPYQ-Ww9qrfUnWvBww5z3oxbFe-SNxkLK20ghX1ekDK7ofvgz99Tv1hN-aJE2ETqHZ3-fahwW1gOXrtOBrtTw+zOPQRlOsVoULroQ3I-l-jJRKKuj1Fp+zxRSGQIMPguGIEZTeIy-1UyVI+GQjcdlK04hQwQjtH4L7sb-KQ2ErZ1N0M3Q44czAfHhnQ2mh8Tw-hrEZQRkfXsrh7gJUwQkBu9HfFFSY4E1j30TV3UPHIbABAIA6buV8Vays-C0Y7vYZC1i0pzRcMODKXx9p9tyq+wdjG6kBJY40uePmqX2CiMGRwfgfaSwbnEZCYcg4K1DuHVWdmalJeQylhpw8P6hJKoeLDWicM5pPQ67aMRct1wK7EFlFoAyrRUl8RsKs4ghiq+qmrKnD1BKAWPTTiYuM8bABliaXwoh3AbH58Zm1kLXDSkOFCLYVJhydNN99T9kvMfq2ExrrmDltM8ht8I18bROAypLe4+0LgB3Fm3L4A57R1hB1dgF8d5vEMW5-ZbB4PNebewgCIKEt6Mty5aDuiEA4EZuC2H1wYMEoQh8p5r1kv1Dwe8EtRyPAxpUtDBiWWV9ohabmHb1rjxE-K8QOpT+65uU+2Q1mn5DMNsQzhPbTHWp0Oty1vRKm6We+uQo6KIto71OiwVDSpCno5ZoF+T1TMPdmtMIKtggvGZcAZR54IOysZP8PsZ6kMCuvlLMkbzhL-PZtG+hzswxT2pfI7msgip-gQ4vMcdDN3j6eek8N6VOrqHycqMD60hHnnIAh6vafBIAYXTqSQkfAMUEH3c8kQdPXvdEMauBVqsFUAxVQoNUamVyPEJxFpXEDBekMpOg9Bdj5PY-WrsDXF9W3v+WQ81ainVkKJWt+lUoJF9e59QAxVinFtkO+zO72HMH7qB9NxcFEJNo+A3+oT-y2f2qm+6pb1K41crzV04uOF3sw54ZH+XSf135-tdL8g1q9cF7NBU1879m9F8n8ZUGADVYAekUQdxahvNrc8MEBQxXdO1do+8PUT8rRh9fVACMor9g0gA */
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
            onDone: {
              target: "CheckingCreditScores",
              actions: assign({
                SSN: ({ event }) => event.output.SSN,
                FirstName: ({ event }) => event.output.firstName,
                LastName: ({ event }) => event.output.lastName,
              }),
            },
            onError: [
              {
                target: "Entering Information",
                actions: assign({
                  ErrorMessage: ({
                    event,
                  }: {
                    context: any;
                    event: { error: any };
                  }) => "Failed to verify credentials. Details: " + event.error,
                }),
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
                      {
                        actions: assign({
                          EquiGavinScore: ({ event }) =>
                            event.output?.creditScore ?? 0,
                        }),
                        target: "FetchingComplete",
                        guard: "equiGavinReportFound",
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
                  entry: [
                    {
                      type: "saveReport",
                      params: {
                        bureauName: "EquiGavin",
                      },
                    },
                  ],
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
                      {
                        actions: assign({
                          EquiGavinScore: ({ event }) => event.output ?? 0,
                        }),
                        target: "FetchingComplete",
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
                      {
                        actions: assign({
                          GavUnionScore: ({ event }) =>
                            event.output?.creditScore ?? 0,
                        }),
                        target: "FetchingComplete",
                        guard: "gavUnionReportFound",
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
                  entry: [
                    {
                      type: "saveReport",
                      params: {
                        bureauName: "GavUnion",
                      },
                    },
                  ],
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
                      {
                        actions: assign({
                          GavUnionScore: ({ event }) => event.output ?? 0,
                        }),
                        target: "FetchingComplete",
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
                      {
                        actions: assign({
                          GavperianScore: ({ event }) =>
                            event.output?.creditScore ?? 0,
                        }),
                        target: "FetchingComplete",
                        guard: "gavperianReportFound",
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
                  entry: [
                    {
                      type: "saveReport",
                      params: {
                        bureauName: "Gavperian",
                      },
                    },
                  ],
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
                      {
                        actions: assign({
                          GavperianScore: ({ event }) => event.output ?? 0,
                        }),
                        target: "FetchingComplete",
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
            {
              target: "DeterminingInterestRateOptions",
              guard: "allSucceeded",
              reenter: true,
            },
            {
              target: "Entering Information",
              actions: assign({
                ErrorMessage: ({ context }) =>
                  "Failed to retrieve credit scores.",
              }),
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
                  {
                    actions: [
                      assign({
                        MiddleScore: ({ event }) => event.output,
                      }),
                      {
                        type: "saveCreditProfile",
                      },
                    ],
                    target: "FetchingRates",
                  },
                ],
              },
            },
            FetchingRates: {
              invoke: {
                input: ({ context: { MiddleScore } }) => MiddleScore,
                src: "generateInterestRates",
                onDone: [
                  {
                    actions: assign({
                      InterestRateOptions: ({ event }) => [event.output],
                    }),
                    target: "RatesProvided",
                  },
                ],
              },
            },
            RatesProvided: {
              entry: [
                {
                  type: "emailUser",
                },
                {
                  type: "emailSalesTeam",
                },
              ],
              type: "final",
            },
          },
        },
      },
    },
  },
});
