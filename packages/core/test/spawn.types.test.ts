import { ActorRefFrom, assign, createMachine } from '../src';

describe('spawn inside machine', () => {
  it('input is required when defined in actor', () => {
    const childMachine = createMachine({
      types: { input: {} as { value: number } }
    });
    createMachine({
      types: {} as { context: { ref: ActorRefFrom<typeof childMachine> } },
      context: ({ spawn }) => ({
        ref: spawn(childMachine, { input: { value: 42 } })
      }),
      initial: 'idle',
      states: {
        Idle: {
          on: {
            event: {
              actions: assign(({ spawn }) => ({
                ref: spawn(childMachine, { input: { value: 42 } })
              }))
            }
          }
        }
      }
    });
  });

  it('input is not required when not defined in actor', () => {
    const childMachine = createMachine({});
    createMachine({
      types: {} as { context: { ref: ActorRefFrom<typeof childMachine> } },
      context: ({ spawn }) => ({
        ref: spawn(childMachine)
      }),
      initial: 'idle',
      states: {
        Idle: {
          on: {
            some: {
              actions: assign(({ spawn }) => ({
                ref: spawn(childMachine)
              }))
            }
          }
        }
      }
    });
  });
});
