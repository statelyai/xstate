import { z } from 'zod';
import {
  createLogic,
  createMachine,
  type ActorRefFromLogic,
  type Spawner
} from '../src';

describe('spawn inside machine', () => {
  it('input is required when defined in actor', () => {
    const childMachine = createMachine({
      // types: { input: {} as { value: number } }
      schemas: {
        input: z.object({ value: z.number() })
      }
    });
    createMachine({
      // types: {} as { context: { ref: ActorRefFrom<typeof childMachine> } },
      schemas: {
        context: z.object({
          ref: z.object({}).optional()
        })
      },
      context: ({ spawn }) => ({
        ref: spawn(childMachine, { input: { value: 42 } })
      }),
      initial: 'idle',
      states: {
        Idle: {
          on: {
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
    const childMachine = createMachine({});
    createMachine({
      // types: {} as { context: { ref: ActorRefFrom<typeof childMachine> } },
      schemas: {
        context: z.object({
          ref: z.object({}).optional()
        })
      },
      context: ({ spawn }) => ({
        ref: spawn(childMachine)
      }),
      initial: 'idle',
      states: {
        Idle: {
          on: {
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

  it('preserves typed trigger API on spawned actors', () => {
    const childMachine = createMachine({
      schemas: {
        events: {
          PING: z.object({
            value: z.string()
          }),
          RESET: z.object({})
        }
      }
    });
    const optionalPayloadLogic = createLogic<
      {},
      unknown,
      { type: 'SEARCH'; query?: string } | { type: 'SAVE'; value: string }
    >({
      context: {},
      run: () => {}
    });

    function _expectTypedSpawner(spawn: Spawner) {
      const childRef = spawn(childMachine);
      const optionalPayloadRef = spawn(optionalPayloadLogic);

      childRef.trigger.PING({ value: 'ok' });
      childRef.trigger.RESET();
      optionalPayloadRef.trigger.SEARCH();
      optionalPayloadRef.trigger.SAVE({ value: 'ok' });

      // @ts-expect-error payload event requires a payload
      childRef.trigger.PING();
      // @ts-expect-error invalid payload
      childRef.trigger.PING({ value: 42 });
      // @ts-expect-error type-only event does not accept a payload
      childRef.trigger.RESET({});
      // @ts-expect-error required payload event still requires a payload
      optionalPayloadRef.trigger.SAVE();

      const actorRef: ActorRefFromLogic<typeof childMachine> = childRef;
      // @ts-expect-error ActorRef is the narrow public interface
      actorRef.trigger.PING({ value: 'ok' });
    }
    void _expectTypedSpawner;

    createMachine({
      entry: (_, enq) => {
        const childRef = enq.spawn(childMachine);
        const optionalPayloadRef = enq.spawn(optionalPayloadLogic);

        childRef.trigger.PING({ value: 'ok' });
        childRef.trigger.RESET();
        optionalPayloadRef.trigger.SEARCH();
        optionalPayloadRef.trigger.SAVE({ value: 'ok' });

        // @ts-expect-error payload event requires a payload
        childRef.trigger.PING();
        // @ts-expect-error invalid payload
        childRef.trigger.PING({ value: 42 });
        // @ts-expect-error type-only event does not accept a payload
        childRef.trigger.RESET({});
        // @ts-expect-error required payload event still requires a payload
        optionalPayloadRef.trigger.SAVE();
      }
    });
  });
});
