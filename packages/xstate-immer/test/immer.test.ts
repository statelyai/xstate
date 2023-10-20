import { createMachine, createActor } from 'xstate';
import { assign, createUpdater, ImmerUpdateEvent } from '../src/index.ts';

describe('@xstate/immer', () => {
  it('should update the context without modifying previous contexts', () => {
    const context = {
      count: 0
    };
    const countMachine = createMachine({
      types: {} as { context: typeof context },
      id: 'count',
      context,
      initial: 'active',
      states: {
        active: {
          on: {
            INC: {
              actions: assign(({ context }) => context.count++)
            }
          }
        }
      }
    });

    const actorRef = createActor(countMachine).start();
    expect(actorRef.getSnapshot().context).toEqual({ count: 0 });

    actorRef.send({ type: 'INC' });
    expect(actorRef.getSnapshot().context).toEqual({ count: 1 });

    actorRef.send({ type: 'INC' });
    expect(actorRef.getSnapshot().context).toEqual({ count: 2 });
  });

  it('should perform multiple updates correctly', () => {
    const context = {
      count: 0
    };
    const countMachine = createMachine(
      {
        types: {} as { context: typeof context },
        id: 'count',
        context,
        initial: 'active',
        states: {
          active: {
            on: {
              INC_TWICE: {
                actions: ['increment', 'increment']
              }
            }
          }
        }
      },
      {
        actions: {
          increment: assign(({ context }) => context.count++)
        }
      }
    );

    const actorRef = createActor(countMachine).start();
    expect(actorRef.getSnapshot().context).toEqual({ count: 0 });

    actorRef.send({ type: 'INC_TWICE' });
    expect(actorRef.getSnapshot().context).toEqual({ count: 2 });
  });

  it('should perform deep updates correctly', () => {
    const context = {
      foo: {
        bar: {
          baz: [1, 2, 3]
        }
      }
    };
    const countMachine = createMachine(
      {
        types: {} as { context: typeof context },
        id: 'count',
        context,
        initial: 'active',
        states: {
          active: {
            on: {
              INC_TWICE: {
                actions: ['pushBaz', 'pushBaz']
              }
            }
          }
        }
      },
      {
        actions: {
          pushBaz: assign(({ context }) => context.foo.bar.baz.push(0))
        }
      }
    );

    const actorRef = createActor(countMachine).start();
    expect(actorRef.getSnapshot().context.foo.bar.baz).toEqual([1, 2, 3]);

    actorRef.send({ type: 'INC_TWICE' });
    expect(actorRef.getSnapshot().context.foo.bar.baz).toEqual([1, 2, 3, 0, 0]);
  });

  it('should create updates', () => {
    interface MyContext {
      foo: {
        bar: {
          baz: number[];
        };
      };
    }
    const context: MyContext = {
      foo: {
        bar: {
          baz: [1, 2, 3]
        }
      }
    };

    type MyEvents =
      | ImmerUpdateEvent<'UPDATE_BAZ', number>
      | ImmerUpdateEvent<'OTHER', string>;

    const bazUpdater = createUpdater<
      typeof context,
      ImmerUpdateEvent<'UPDATE_BAZ', number>,
      MyEvents
    >('UPDATE_BAZ', ({ context, event }) => {
      context.foo.bar.baz.push(event.input);
    });

    const countMachine = createMachine({
      types: {
        context: {} as MyContext,
        events: {} as MyEvents
      },
      id: 'count',
      context,
      initial: 'active',
      states: {
        active: {
          on: {
            [bazUpdater.type]: {
              actions: bazUpdater.action
            }
          }
        }
      }
    });

    const actorRef = createActor(countMachine).start();
    expect(actorRef.getSnapshot().context.foo.bar.baz).toEqual([1, 2, 3]);

    actorRef.send(bazUpdater.update(4));
    expect(actorRef.getSnapshot().context.foo.bar.baz).toEqual([1, 2, 3, 4]);
  });

  it('should create updates (form example)', (done) => {
    interface FormContext {
      name: string;
      age: number | undefined;
    }

    type NameUpdateEvent = ImmerUpdateEvent<'UPDATE_NAME', string>;
    type AgeUpdateEvent = ImmerUpdateEvent<'UPDATE_AGE', number>;

    type FormEvent =
      | NameUpdateEvent
      | AgeUpdateEvent
      | {
          type: 'SUBMIT';
        };

    const nameUpdater = createUpdater<FormContext, NameUpdateEvent, FormEvent>(
      'UPDATE_NAME',
      ({ context, event }) => {
        context.name = event.input;
      }
    );

    const ageUpdater = createUpdater<FormContext, AgeUpdateEvent, FormEvent>(
      'UPDATE_AGE',
      ({ context, event }) => {
        context.age = event.input;
      }
    );

    const formMachine = createMachine({
      types: {} as { context: FormContext; events: FormEvent },
      initial: 'editing',
      context: {
        name: '',
        age: undefined
      },
      states: {
        editing: {
          on: {
            [nameUpdater.type]: { actions: nameUpdater.action },
            [ageUpdater.type]: { actions: ageUpdater.action },
            SUBMIT: 'submitting'
          }
        },
        submitting: {
          always: {
            target: 'success',
            guard: ({ context }) => {
              return context.name === 'David' && context.age === 0;
            }
          }
        },
        success: {
          type: 'final'
        }
      }
    });

    const service = createActor(formMachine);
    service.subscribe({
      complete: () => {
        done();
      }
    });
    service.start();

    service.send(nameUpdater.update('David'));
    service.send(ageUpdater.update(0));

    service.send({ type: 'SUBMIT' });
  });
});
