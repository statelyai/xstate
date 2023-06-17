import { InspectionEvent, createMachine, interpret } from '../src';

describe('inspect', () => {
  it('the .interpret option can observe inspection events', () => {
    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          on: {
            NEXT: 'b'
          }
        },
        b: {
          on: {
            NEXT: 'c'
          }
        },
        c: {}
      }
    });

    const events: InspectionEvent[] = [];

    const actor = interpret(machine, {
      inspect: {
        next(event) {
          events.push(event);
        }
      }
    });
    actor.start();
    actor.send({ type: 'NEXT' });
    actor.send({ type: 'NEXT' });

    expect(events).toEqual([
      expect.objectContaining({
        type: '@xstate.registration'
      }),
      expect.objectContaining({
        type: '@xstate.transition',
        event: { type: 'xstate.init' },
        snapshot: expect.objectContaining({
          value: 'a'
        })
      }),
      expect.objectContaining({
        type: '@xstate.transition',
        event: { type: 'NEXT' },
        snapshot: expect.objectContaining({
          value: 'b'
        })
      }),
      expect.objectContaining({
        type: '@xstate.transition',
        event: { type: 'NEXT' },
        snapshot: expect.objectContaining({
          value: 'c'
        })
      })
    ]);
  });
});
