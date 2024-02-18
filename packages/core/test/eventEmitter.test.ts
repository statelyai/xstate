import { AnyEventObject, createActor, createMachine } from '../src';
import { emit } from '../src/actions/emit';

describe('event emitter', () => {
  it('emits events that can be listened to on actorRef.on(…)', async () => {
    const machine = createMachine({
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
});
