import { setup, assign, assertEvent, fromPromise } from "xstate";
import { createActorContext } from "@xstate/react";
import { generateDate } from "../utils";
import { sleep } from "../utils";

export const TODAY = generateDate(0);
const TOMORROW = generateDate(1);

export const flightBookerMachine = setup({
  types: {
    context: {} as FlightData,
    events: {} as
      | { type: "BOOK_DEPART" }
      | { type: "BOOK_RETURN" }
      | { type: "CHANGE_TRIP_TYPE"; tripType: "oneWay" | "roundTrip" }
      | { type: "CHANGE_DEPART_DATE"; value: string }
      | { type: "CHANGE_RETURN_DATE"; value: string },
  },
  actions: {
    setDepartDate: assign(({ event }) => {
      assertEvent(event, "CHANGE_DEPART_DATE");
      return { departDate: event.value };
    }),
    setReturnDate: assign(({ event }) => {
      assertEvent(event, "CHANGE_RETURN_DATE");
      return { returnDate: event.value };
    }),
    setTripType: assign(({ event }) => {
      assertEvent(event, "CHANGE_TRIP_TYPE");
      return { tripType: event.tripType };
    }),
  },
  actors: {
    Booker: fromPromise(() => {
      return sleep(1000);
    }),
  },
  guards: {
    "isValidDepartDate?": ({ context: { departDate } }) => {
      return departDate >= TODAY;
    },
    "isValidReturnDate?": ({ context: { departDate, returnDate } }) => {
      return departDate >= TODAY && returnDate > departDate;
    },
  },
}).createMachine({
  id: "flightBookerMachine",
  context: {
    departDate: TODAY,
    returnDate: TOMORROW,
    tripType: "oneWay",
  },
  initial: "scheduling",
  states: {
    scheduling: {
      initial: "oneWay",
      on: {
        CHANGE_DEPART_DATE: {
          actions: {
            type: "setDepartDate",
          },
        },

        BOOK_DEPART: {
          target: "booking",
          guard: {
            type: "isValidDepartDate?",
          },
        },

        BOOK_RETURN: {
          target: "booking",
          guard: {
            type: "isValidReturnDate?",
          },
        },
      },
      states: {
        oneWay: {
          on: {
            CHANGE_TRIP_TYPE: {
              target: "roundTrip",
              actions: {
                type: "setTripType",
                tripType: "roundTrip",
              },
            },
          },
        },
        roundTrip: {
          on: {
            CHANGE_TRIP_TYPE: {
              target: "oneWay",
              actions: {
                type: "setTripType",
                tripType: "oneWay",
              },
            },

            CHANGE_RETURN_DATE: {
              actions: {
                type: "setReturnDate",
              },
            },
          },
        },
      },
    },
    booking: {
      invoke: {
        src: "Booker",
        onDone: {
          target: "booked",
        },
        onError: {
          target: "scheduling",
        },
      },
    },
    booked: {
      type: "final",
    },
  },
});

export default createActorContext(flightBookerMachine);
