import { setup, assign } from "xstate";

export const counterMachine = setup({
  types: {
    context: {} as { count: number },
    events: {} as { type: "increase" },
  },
}).createMachine(
  {
    context: {
      count: 0,
    },
    id: "Counter",
    initial: "ready",
    states: {
      ready: {
        on: {
          increase: {
            target: "ready",
            actions: assign({
              count: ({ context }) => context.count+1,
            }),
          },
        },
      },
    },
  },
);
