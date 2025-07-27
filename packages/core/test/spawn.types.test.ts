import { z } from 'zod';
import { ActorRefFrom, assign, next_createMachine } from '../src';

describe('spawn inside machine', () => {
  it('input is required when defined in actor', () => {
    const childMachine = next_createMachine({
      // types: { input: {} as { value: number } }
      schemas: {
        input: z.object({ value: z.number() })
      }
    });
    next_createMachine({
      types: {} as { context: { ref: ActorRefFrom<typeof childMachine> } },
      context: ({ spawn }) => ({
        ref: spawn(childMachine, { input: { value: 42 } })
      }),
      initial: 'idle',
      states: {
        Idle: {
          on: {
            // event: {
            //   actions: assign(({ spawn }) => ({
            //     ref: spawn(childMachine, { input: { value: 42 } })
            //   }))
            // }
            event: (_, enq) => ({
              context: {
                ref: enq.spawn(childMachine, { input: { value: 42 } })
              }
            })
          }
        }
      }
    });
  });

  it('input is not required when not defined in actor', () => {
    const childMachine = next_createMachine({});
    next_createMachine({
      types: {} as { context: { ref: ActorRefFrom<typeof childMachine> } },
      context: ({ spawn }) => ({
        ref: spawn(childMachine)
      }),
      initial: 'idle',
      states: {
        Idle: {
          on: {
            // some: {
            //   actions: assign(({ spawn }) => ({
            //     ref: spawn(childMachine)
            //   }))
            // }
            some: (_, enq) => ({
              context: {
                ref: enq.spawn(childMachine)
              }
            })
          }
        }
      }
    });
  });
});
