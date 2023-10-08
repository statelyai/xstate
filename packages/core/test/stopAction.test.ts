import {
  AnyActorRef,
  createActor,
  createMachine,
  fromPromise,
  stop
} from '../src/index.ts';

describe('stop() action creator', () => {
  it('should be able to stop multiple actors', () => {
    const machine = createMachine({
      types: {
        context: {} as {
          actors: Array<AnyActorRef>;
        }
      },
      context: ({ spawn }) => {
        return {
          actors: [
            spawn(fromPromise(() => Promise.resolve('foo'))),
            spawn(fromPromise(() => Promise.resolve('bar'))),
            spawn(fromPromise(() => Promise.resolve('baz')))
          ]
        };
      },
      on: {
        stopAll: {
          actions: stop(({ context }) => context.actors)
        }
      }
    });

    const actor = createActor(machine).start();

    expect(
      actor.getSnapshot().context.actors.map((a) => a.getSnapshot().status)
    ).toEqual(['active', 'active', 'active']);

    actor.send({ type: 'stopAll' });

    expect(
      actor.getSnapshot().context.actors.map((a) => a.getSnapshot().status)
    ).toEqual(['stopped', 'stopped', 'stopped']);
  });
});
