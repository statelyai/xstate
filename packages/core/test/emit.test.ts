import {
  AnyEventObject,
  createActor,
  createMachine,
  enqueueActions,
  setup
} from '../src';
import { emit } from '../src/actions/emit';

describe('event emitter', () => {
  it('only emits expected events if specified in setup', () => {
    setup({
      types: {
        emitted: {} as { type: 'greet'; message: string }
      }
    }).createMachine({
      // @ts-expect-error
      entry: emit({ type: 'nonsense' }),
      // @ts-expect-error
      exit: emit({ type: 'greet', message: 1234 }),

      on: {
        someEvent: {
          actions: emit({ type: 'greet', message: 'hello' })
        }
      }
    });
  });

  it('emits any events if not specified in setup (unsafe)', () => {
    createMachine({
      entry: emit({ type: 'nonsense' }),
      exit: emit({ type: 'greet', message: 1234 }),
      on: {
        someEvent: {
          actions: emit({ type: 'greet', message: 'hello' })
        }
      }
    });
  });

  it('emits events that can be listened to on actorRef.on(…)', async () => {
    const machine = setup({
      types: {
        emitted: {} as { type: 'emitted'; foo: string }
      }
    }).createMachine({
      on: {
        someEvent: {
          actions: emit({ type: 'emitted', foo: 'bar' })
        }
      }
    });

    const actor = createActor(machine).start();
    setTimeout(() => {
      actor.send({
        type: 'someEvent'
      });
    });
    const event = await new Promise<AnyEventObject>((res) => {
      actor.on('emitted', res);
    });

    expect(event.foo).toBe('bar');
  });

  it('enqueue.emit(…) emits events that can be listened to on actorRef.on(…)', async () => {
    const machine = setup({
      types: {
        emitted: {} as { type: 'emitted'; foo: string }
      }
    }).createMachine({
      on: {
        someEvent: {
          actions: enqueueActions(({ enqueue }) => {
            enqueue.emit({ type: 'emitted', foo: 'bar' });

            enqueue.emit({
              // @ts-expect-error
              type: 'unknown'
            });
          })
        }
      }
    });

    const actor = createActor(machine).start();
    setTimeout(() => {
      actor.send({
        type: 'someEvent'
      });
    });
    const event = await new Promise<AnyEventObject>((res) => {
      actor.on('emitted', res);
    });

    expect(event.foo).toBe('bar');
  });

  it('dynamically emits events that can be listened to on actorRef.on(…)', async () => {
    const machine = createMachine({
      context: { count: 10 },
      on: {
        someEvent: {
          actions: emit(({ context }) => ({
            type: 'emitted',
            count: context.count
          }))
        }
      }
    });

    const actor = createActor(machine).start();
    setTimeout(() => {
      actor.send({
        type: 'someEvent'
      });
    });
    const event = await new Promise<AnyEventObject>((res) => {
      actor.on('emitted', res);
    });

    expect(event).toEqual({
      type: 'emitted',
      count: 10
    });
  });
});
