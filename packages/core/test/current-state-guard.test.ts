import { createActor, createMachine, matchesState } from '../src/index.ts';

it.each(['raised event', 'eventless transition'])(
  'checks the current microstep when migrating stateIn (%s)',
  (trigger) => {
    const committed: boolean[] = [];
    const machine = createMachine({
      type: 'parallel',
      states: {
        a: {
          initial: 'one',
          states: {
            one: {
              on: {
                go: (_, enq) => {
                  if (trigger === 'raised event') enq.raise({ type: 'check' });
                  return { target: 'two' };
                }
              }
            },
            two: {}
          }
        },
        b: {
          initial: 'pending',
          states: {
            pending:
              trigger === 'raised event'
                ? {
                    on: {
                      check: ({ self, value }) => {
                        if (!matchesState({ a: 'two' }, value)) return;
                        committed.push(
                          self.getSnapshot().matches({ a: 'two' })
                        );
                        return { target: 'accepted' };
                      }
                    }
                  }
                : {
                    always: ({ self, value }) => {
                      if (!matchesState({ a: 'two' }, value)) return;
                      committed.push(self.getSnapshot().matches({ a: 'two' }));
                      return { target: 'accepted' };
                    }
                  },
            accepted: {}
          }
        }
      }
    });
    const actor = createActor(machine).start();
    actor.send({ type: 'go' });
    expect(actor.getSnapshot().value).toEqual({ a: 'two', b: 'accepted' });
    expect(committed).toEqual([false]);
    actor.stop();
  }
);
