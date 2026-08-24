import { z } from 'zod';
import {
  createLogic,
  createMachine,
  setup,
  type ActorRefFromLogic,
  type Spawner
} from '../src';

describe('spawn inside machine', () => {
  it('input is required when defined in actor', () => {
    const childMachine = createLogic<
      { value: number },
      string,
      { type: 'PING'; value: string },
      { value: number }
    >({
      context: ({ input }) => input,
      run: ({ context }) => ({ context })
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
      initial: 'Idle',
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

    createMachine({
      actors: { child: childMachine },
      entry: ({ actors }, enq) => {
        const childRef = enq.spawn(actors.child, {
          input: { value: 42 }
        });
        childRef satisfies ActorRefFromLogic<typeof childMachine>;

        const childRefBySource = enq.spawn('child', {
          input: { value: 42 }
        });
        childRefBySource satisfies ActorRefFromLogic<typeof childMachine>;
        childRefBySource.send({ type: 'PING', value: 'ok' });
        childRefBySource.getSnapshot().context.value satisfies number;
        childRefBySource.getSnapshot().output satisfies string | undefined;

        // @ts-expect-error input is required by the selected actor source
        enq.spawn('child');
        // @ts-expect-error input is typed from the selected actor source
        enq.spawn('child', { input: { value: 'wrong' } });
        // @ts-expect-error arbitrary strings are not actor sources
        enq.spawn('other', { input: { value: 42 } });
      }
    });

    setup({}).createMachine({
      entry: (_, enq) => {
        // @ts-expect-error arbitrary strings are not actor sources
        enq.spawn('other');
      }
    });
  });

  it('types string sources added through provide and extend', () => {
    const childMachine = createMachine({
      schemas: {
        input: z.object({ value: z.number() }),
        events: { PING: z.object({ value: z.string() }) }
      }
    });

    createMachine({
      actors: {} as { child: typeof childMachine },
      entry: (_, enq) => {
        const child = enq.spawn('child', { input: { value: 42 } });
        child.trigger.PING({ value: 'ok' });
        child satisfies ActorRefFromLogic<typeof childMachine>;
      }
    }).provide({ actors: { child: childMachine } });

    setup()
      .extend({ actors: { child: childMachine } })
      .createMachine({
        entry: (_, enq) => {
          const child = enq.spawn('child', { input: { value: 42 } });
          child.trigger.PING({ value: 'ok' });
          child satisfies ActorRefFromLogic<typeof childMachine>;
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
      initial: 'Idle',
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
