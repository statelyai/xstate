import { ContextFrom, createMachine, EventFrom } from '../src';
import {
  assign,
  cancel,
  choose,
  log,
  send,
  sendParent,
  sendUpdate,
  stop
} from '../src/actions';
import { createModel } from '../src/model';

describe('createModel', () => {
  it('model.assign updates context and is typed correctly', () => {
    type UserEvent =
      | {
          type: 'updateName';
          value: string;
        }
      | { type: 'updateAge'; value: number }
      | { type: 'anotherEvent' };

    interface UserContext {
      name: string;
      age: number;
    }

    const userModel = createModel<UserContext, UserEvent>({
      name: 'David',
      age: 30
    });

    // Example of an externally-defined assign action
    const assignName = userModel.assign(
      {
        name: (_, event) => {
          return event.value;
        }
      },
      'updateName'
    );

    const machine = createMachine<UserContext, UserEvent>({
      context: userModel.initialContext,
      initial: 'active',
      states: {
        active: {
          on: {
            updateName: {
              // pre-defined assign action
              actions: assignName
            },
            updateAge: {
              // inline assign action
              actions: userModel.assign((_, e) => {
                return {
                  age: e.value
                };
              })
            }
          }
        }
      }
    });

    const updatedState = machine.transition(undefined, {
      type: 'updateName',
      value: 'Anyone'
    });

    expect(updatedState.context.name).toEqual('Anyone');
  });

  it('model.reset resets the context to its initial value', () => {
    type UserEvent =
      | {
          type: 'updateName';
          value: string;
        }
      | { type: 'updateAge'; value: number }
      | { type: 'reset' };

    interface UserContext {
      name: string;
      age: number;
    }

    const userModel = createModel<UserContext, UserEvent>({
      name: 'David',
      age: 30
    });

    // Example of an externally-defined assign action
    const assignName = userModel.assign(
      {
        name: (_, event) => {
          return event.value;
        }
      },
      'updateName'
    );

    const machine = createMachine<UserContext, UserEvent>({
      context: userModel.initialContext,
      initial: 'active',
      states: {
        active: {
          on: {
            updateName: {
              // pre-defined assign action
              actions: assignName
            },
            updateAge: {
              // inline assign action
              actions: userModel.assign((_, e) => {
                return {
                  age: e.value
                };
              })
            },
            reset: {
              actions: userModel.reset()
            }
          }
        }
      }
    });

    const updatedState = machine.transition(undefined, {
      type: 'updateName',
      value: 'Anyone'
    });

    expect(updatedState.context.name).toEqual('Anyone');

    const resetState = machine.transition(undefined, {
      type: 'reset'
    });

    expect(resetState.context).toEqual(userModel.initialContext);
  });

  it('can model events', () => {
    const userModel = createModel(
      {
        name: 'David',
        age: 30
      },
      {
        events: {
          updateName: (value: string) => ({ value }),
          updateAge: (value: number) => {
            const payload = {
              value
            };
            (payload as any).type = 'this should be overwritten';
            return payload;
          },
          anotherEvent: () => ({})
        }
      }
    );

    // Example of an externally-defined assign action
    const assignName = userModel.assign(
      {
        name: (_, event) => {
          return event.value;
        }
      },
      'updateName'
    );

    const machine = userModel.createMachine({
      initial: 'active',
      states: {
        active: {
          on: {
            updateName: {
              // pre-defined assign action
              actions: [assignName]
            },
            updateAge: {
              // inline assign action
              actions: userModel.assign((_, e) => {
                return {
                  age: e.value
                };
              })
            }
          }
        }
      }
    });

    let updatedState = machine.transition(
      undefined,
      userModel.events.updateName('Anyone')
    );

    expect(updatedState.context.name).toEqual('Anyone');

    updatedState = machine.transition(
      updatedState,
      userModel.events.updateAge(42)
    );

    expect(updatedState.context.age).toEqual(42);
  });

  it('can model actions', () => {
    const userModel = createModel(
      {
        name: 'David',
        age: 30
      },
      {
        actions: {
          greet: (message: string) => ({ message })
        }
      }
    );

    userModel.createMachine({
      context: userModel.initialContext,
      initial: 'active',
      entry: { type: 'greet', message: 'hello' },
      exit: { type: 'greet', message: 'goodbye' },
      states: {
        active: {
          entry: [userModel.actions.greet('hello')]
        }
      }
    });

    userModel.createMachine({
      context: userModel.initialContext,
      // @ts-expect-error
      entry: { type: 'greet' } // missing message
    });

    userModel.createMachine({
      context: userModel.initialContext,
      // @ts-expect-error
      entry: { type: 'fake' } // wrong message
    });
  });

  it('works with built-in actions', () => {
    const model = createModel(
      {},
      {
        events: {
          SAMPLE: () => ({})
        },
        actions: {
          custom: () => ({})
        }
      }
    );

    model.createMachine({
      context: model.initialContext,
      entry: [
        model.actions.custom(),
        // raise('SAMPLE'),
        send('SAMPLE'),
        sendParent('SOMETHING'),
        sendUpdate(),
        // respond('SOMETHING'),
        log('something'),
        cancel('something'),
        stop('something'),
        model.assign({}),
        choose([])
      ],
      exit: [
        model.actions.custom(),
        // raise('SAMPLE'),
        send('SAMPLE'),
        sendParent('SOMETHING'),
        sendUpdate(),
        // respond('SOMETHING'),
        log('something'),
        cancel('something'),
        stop('something'),
        model.assign({}),
        choose([])
      ],
      on: {
        SAMPLE: {
          actions: [
            model.actions.custom(),
            // raise('SAMPLE'),
            send('SAMPLE'),
            sendParent('SOMETHING'),
            sendUpdate(),
            // respond('SOMETHING'),
            log('something'),
            cancel('something'),
            stop('something'),
            model.assign({}),
            choose([])
          ]
        }
      },
      initial: 'someState',
      states: {
        someState: {
          entry: [
            model.actions.custom(),
            // raise('SAMPLE'),
            send('SAMPLE'),
            sendParent('SOMETHING'),
            sendUpdate(),
            // respond('SOMETHING'),
            log('something'),
            cancel('something'),
            stop('something'),
            model.assign({}),
            choose([])
          ],
          exit: [
            model.actions.custom(),
            // raise('SAMPLE'),
            send('SAMPLE'),
            sendParent('SOMETHING'),
            sendUpdate(),
            // respond('SOMETHING'),
            log('something'),
            cancel('something'),
            stop('something'),
            model.assign({}),
            choose([])
          ]
        }
      }
    });
  });

  it('should strongly type action implementations', () => {
    const model = createModel(
      {},
      {
        events: {
          SAMPLE: () => ({})
        },
        actions: {
          custom: (param: string) => ({ param })
        }
      }
    );

    model.createMachine(
      {
        context: {}
      },
      {
        actions: {
          custom: (_ctx, _e, { action }) => {
            action.param.toUpperCase();

            // @ts-expect-error
            action.param.whatever();

            // @ts-expect-error
            action.unknown;
          }
        }
      }
    );
  });

  it('should strongly type action implementations with model.createMachine(...)', () => {
    const model = createModel(
      {},
      {
        events: {
          SAMPLE: () => ({})
        },
        actions: {
          custom: (param: string) => ({ param })
        }
      }
    );

    model.createMachine(
      {
        context: {}
      },
      {
        actions: {
          custom: (_ctx, _e, { action }) => {
            action.param.toUpperCase();

            // @ts-expect-error
            action.param.whatever();

            // @ts-expect-error
            action.unknown;
          }
        }
      }
    );
  });

  it('should disallow string actions for non-simple actions', () => {
    const model = createModel(
      {},
      {
        events: {
          SAMPLE: () => ({})
        },
        actions: {
          simple: () => ({}),
          custom: (param: string) => ({ param })
        }
      }
    );

    model.createMachine({
      entry: ['simple', { type: 'custom', param: 'something' }],

      // @ts-expect-error
      exit: ['custom'],
      initial: 'test',
      states: {
        test: {
          entry: ['simple', { type: 'custom', param: 'something' }],

          // @ts-expect-error
          exit: ['custom']
        }
      }
    });
  });

  it('should typecheck `createMachine` for model without creators', () => {
    const toggleModel = createModel(
      { count: 0 },
      {
        events: {
          TOGGLE: () => ({})
        }
      }
    );

    toggleModel.createMachine({
      id: 'machine',
      initial: 'inactive',
      states: {
        inactive: {
          on: { TOGGLE: 'active' }
        },
        active: {
          on: { TOGGLE: 'inactive' }
        }
      }
    });
  });

  it('model.createMachine(...) should provide the initial context', () => {
    const toggleModel = createModel({ count: 0 });

    const machine = toggleModel.createMachine({});

    expect(machine.initialState.context.count).toBe(0);
  });

  it('should not allow using events if creators have not been configured', () => {
    const model = createModel({ count: 0 });

    // this is a type test for something that is not available at runtime so we suppress runtime error with try/catch
    try {
      // this should not end up being `any`
      // @ts-expect-error
      model.events.test();
    } catch (err) {}
  });

  it('should not allow using actions if creators have not been configured', () => {
    const model = createModel({ count: 0 });

    // this is a type test for something that is not available at runtime so we suppress runtime error with try/catch
    try {
      // this should not end up being `any`
      // @ts-expect-error
      model.actions.test();
    } catch (err) {}
  });

  it('should allow for the action type to be explicitly given when creators have not been configured', () => {
    const model = createModel<
      { count: number },
      { type: 'EV' },
      { type: 'fooAction' }
    >({ count: 0 });

    model.createMachine({
      context: model.initialContext,
      initial: 'a',
      states: {
        a: {
          entry: 'fooAction'
        },
        b: {
          // @ts-expect-error
          entry: 'barAction'
        }
      }
    });
  });

  it('should allow any action if actions are not specified', () => {
    const model = createModel(
      {},
      {
        events: {}
      }
    );

    model.createMachine({
      entry: 'someAction',
      exit: { type: 'someObjectAction' },
      on: {
        // @ts-expect-error
        UNEXPECTED_EVENT: {}
      }
    });
  });

  it('should infer context correctly when actions are not specified', () => {
    const model = createModel(
      { foo: 100 },
      {
        events: {
          BAR: () => ({})
        }
      }
    );

    model.createMachine({
      entry: (ctx) => {
        // @ts-expect-error assert indirectly that `ctx` is not `any` or `unknown`
        ctx.other;
      },
      exit: assign({
        foo: (ctx) => {
          // @ts-expect-error assert indirectly that `ctx` is not `any` or `unknown`
          ctx.other;
          return ctx.foo;
        }
      })
    });
  });

  it('should keep the context type on the state after using `state.matches`', () => {
    const model = createModel<{ count: number }, { type: 'INC' }>({ count: 0 });

    const machine = model.createMachine({
      context: model.initialContext,
      states: {
        a: {}
      }
    });

    if (machine.initialState.matches('a')) {
      machine.initialState.context.count;
      // @ts-expect-error
      machine.initialState.context.unknown;
    }
  });

  it('ContextFrom accepts a model type', () => {
    const model = createModel(
      { count: 3 },
      {
        events: {}
      }
    );

    const val = ({} as unknown) as ContextFrom<typeof model>;

    // expect no type error here
    // with previous ContextFrom behavior, this will not compile
    val.count;

    // @ts-expect-error (sanity check)
    val.unknown;
  });

  it('EventFrom accepts a model type', () => {
    const model = createModel(
      { count: 3 },
      {
        events: {
          INC: () => ({})
        }
      }
    );

    const val = ({} as unknown) as EventFrom<typeof model>;

    // expect no type error here
    // with previous EventFrom behavior, this will not compile
    val.type;

    // @ts-expect-error (sanity check)
    val.count;
  });
});
