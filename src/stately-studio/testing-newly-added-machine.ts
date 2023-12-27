import { createMachine } from "xstate";

export const machine = createMachine(
  {
    /** @xstate-layout N4IgpgJg5mDOIC5QBU4BcCWA7KACLYA7gDYCeuAhhBJLgLYUDGAFtmPQPYQYBmGt2XAHEAErgAKAJVwAmAHQBJLBkwViuWGgpowAYgIAPNAG0ADAF1EoAA4dYKjByxWQBxABYAnAA45AZgBGAFYA03cAgDYoqIB2ABoQUkQZUyCAXzSE1E1sPAIScioaCHomVgJObj4BLGExKVk5AEEsDjRmMAAnDS0dfTAjM0skEFt7TCcXNwQZb3kYwJiY028-NfX4xI9QjKz0XPwiMkpqWgYWNkrefhLBUQlpeRa2ju7NbT1DEwDhmzsHSYjaYyGJBOQxGQBPxBcLRWIJJIzVK7EDZTA4Q4FE7FUoXCp0LjXGp1B6NcQUTpgLBoHofOQAYVYxBK7z6XyGLjGAOcQMQwV8c28ARkQQRiAicxRaIO+WORTOZUuBKqN1wd3qjzk5Mp1NpfQARkwANYckZciY80DTZbg1IQzyROERTaIgKSlGtGjwEbSjGywqnErncrsZVE261e4NGSc-4WqZ8mRihDCqX7P1HAM44NKwnVCMk6OKZSqdSssCx8aOS2uROmORBGQRMKOp0uxCeUxpnIZrHyoOK-F51Xq0lPVrtLp6itmuPVhMIdxRORO1fO5OBbzd9F5TPYhV40PD4lRzXaqk08uV7kL5vJoKmLuZVHp3d9wO4kNXfNqyMaskUhe04MkyLK9DOfxVoCVp8n4MQrkEEQivenbbjKe79p+uYqie-7yOeurls0E6vLgFzMtO17xryKYrMmSwyBkGRAA */
    id: "Testing newly added machine modified in GH PR 2",
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
