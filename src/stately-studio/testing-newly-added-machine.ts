import { createMachine } from "xstate";

export const machine = createMachine(
  {
    /** @xstate-layout N4IgpgJg5mDOIC5QBU4BcCWA7KACLYA7gDYCeuAhhBJLgLYUDGAFtmAHQCSWGmFxuWGgpowAYgIAPNAG0ADAF1EoAA4B7WLwxqsykJMQAmAIwAOdnMMB2QwDZLATmPGAzAFYHAGhCkjV9m5WACyGci5BTiZyDkEAvrHeqELYeAQk5FQ0EPRMrATsAAoUAE5gWGiCwqLsAMKsxNlCIuJSsop66pqYOnoGCC4O-g62pra2bi5WMS7Gbt6+-W7G7CMmkw6mQS6hcQkgSZg4+ERklNS0DCxs7ACCWGpozGDFlc0SYNLySkggnVo9Pz6bjchnYQRBxgi4OCcmC80QpnMzm2pmi4WchkMpniiXQKWO6TOWRyV3ydweTxeTVE70+xm+qg0-10gKMxn8hiC9mMjmRHnhCER7GRWLRQQxWJx+zxRzSp0yF1y1yKpXKrxpACMmABrL4dJndFmgPqudiIhwgoKjezgywClwucy2BxRB1WWwhKzGeJ7e40eA-A74uUZc7ZS55MD6rraI36RAAWhctnYO0xSwdFoipgFCeBYMMgVMxkLUqDspOoeJEeu0eZvQRcjkAsxAWCJlMVjcZZlqUrRMVpI43C0-HVUZ+f0NDYQznYU0CwWtclthhboMCITMXZ7yQrhIV4aV+RVZQq1InjJjAONiHZ-nsDhmAw9m0dLbcKdsXs2QStnJMBxd0OPsDzDElI0KEoz3HWp6kaKpL1+A1YxndMVjRVxhitLYcx8RBwi-H8-3-LcgL2ctQPlcCaxPaC1QvW57keZ5cCuBpxzradWQQEEXDNQYuWMC0YThfD+i5FZTDWKY3x2YDg37Q8IOuckWKpRCuNQniPFBTkS2cESglhIJ1zbLdO27H0gA */
    id: "Testing newly added machine modified in GH PR",
    initial: "Initial state",
    states: {
      "Initial state": {
        on: {
          next: {
            target: "Another state",
          },
        },
      },
      "Another state": {
        on: {
          next: [
            {
              target: "Parent state",
              cond: "some condition",
            },
            {
              target: "Initial state",
            },
          ],
        },
      },
      "Parent state": {
        initial: "Child state",
        states: {
          "Child state": {
            on: {
              next: {
                target: "Another child state",
              },
            },
          },
          "Another child state": {},
        },
        on: {
          back: {
            target: "Initial state",
            actions: {
              type: "reset",
            },
          },
        },
      },
    },
    schema: { events: {} as { type: "next" } | { type: "back" } },
    predictableActionArguments: true,
    preserveActionOrder: true,
    tsTypes: {},
  },
  {
    actions: {
      reset: (context, event) => {},
    },
    services: {},
    guards: {
      "some condition": (context, event) => {
        return false;
      },
    },
    delays: {},
  },
);
