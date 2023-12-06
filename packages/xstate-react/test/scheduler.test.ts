import {
  cancel,
  createActor,
  createMachine,
  raise,
  sendTo
} from '../../core/src';

describe('scheduler', () => {
  it('timer IDs should be isolated to actor refs', () => {
    jest.useFakeTimers();
    const fooSpy = jest.fn();
    const barSpy = jest.fn();

    const machine = createMachine({
      invoke: [
        {
          id: 'foo',
          src: createMachine({
            id: 'foo',
            entry: raise({ type: 'event' }, { id: 'sameId', delay: 100 }),
            on: {
              event: { actions: fooSpy },
              cancel: { actions: cancel('sameId') }
            }
          })
        },
        {
          id: 'bar',
          src: createMachine({
            id: 'bar',
            entry: raise({ type: 'event' }, { id: 'sameId', delay: 100 }),
            on: {
              event: { actions: barSpy },
              cancel: { actions: cancel('sameId') }
            }
          })
        }
      ],
      on: {
        cancelFoo: {
          actions: sendTo('foo', { type: 'cancel' })
        }
      }
    });
    const actor = createActor(machine).start();

    jest.advanceTimersByTime(50);

    // This will cause the foo actor to cancel its 'sameId' delayed event
    // This should NOT cancel the 'sameId' delayed event in the other actor
    actor.send({ type: 'cancelFoo' });

    jest.advanceTimersByTime(55);

    expect(fooSpy).not.toHaveBeenCalled();
    expect(barSpy).toHaveBeenCalledTimes(1);
  });
});
