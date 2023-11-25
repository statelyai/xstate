import { render } from '@testing-library/react';
import * as React from 'react';
import {
  ActorRefFrom,
  assign,
  createMachine,
  InterpreterFrom,
  TypegenMeta
} from 'xstate';
import { createActorContext, useInterpret, useMachine } from '../src';

describe('useMachine', () => {
  it('should allow to be used with a machine without any missing implementations', () => {
    interface TypesMeta extends TypegenMeta {
      missingImplementations: {
        actions: never;
        delays: never;
        guards: never;
        services: never;
      };
    }

    const machine = createMachine({
      tsTypes: {} as TypesMeta
    });

    function App() {
      useMachine(machine);
      return null;
    }

    render(<App />);
  });

  it('should not allow to be used with a machine with some missing implementations', () => {
    interface TypesMeta extends TypegenMeta {
      missingImplementations: {
        actions: 'myAction';
        delays: never;
        guards: never;
        services: never;
      };
      eventsCausingActions: {
        myAction: 'FOO';
      };
    }

    const machine = createMachine({
      tsTypes: {} as TypesMeta,
      schema: {
        events: {} as { type: 'FOO' } | { type: 'BAR' } | { type: 'BAZ' }
      }
    });

    function App() {
      // @ts-expect-error
      useMachine(machine);
      return null;
    }

    render(<App />);
  });

  it('should require all missing implementations ', () => {
    interface TypesMeta extends TypegenMeta {
      missingImplementations: {
        actions: 'myAction';
        delays: 'myDelay';
        guards: never;
        services: never;
      };
      eventsCausingActions: {
        myAction: 'FOO';
        myDelay: 'BAR';
      };
    }

    const machine = createMachine({
      tsTypes: {} as TypesMeta,
      schema: {
        events: {} as { type: 'FOO' } | { type: 'BAR' } | { type: 'BAZ' }
      }
    });

    function App() {
      // @ts-expect-error
      useMachine(machine, {});
      useMachine(machine, {
        // @ts-expect-error
        actions: {}
      });
      // @ts-expect-error
      useMachine(machine, {
        actions: {
          myAction: () => {}
        }
      });
      useMachine(machine, {
        actions: {
          myAction: () => {}
        },
        delays: {
          myDelay: () => 42
        }
      });
      return null;
    }

    render(<App />);
  });

  it('should allow to override already provided implementation', () => {
    interface TypesMeta extends TypegenMeta {
      missingImplementations: {
        actions: 'fooAction';
        delays: never;
        guards: never;
        services: never;
      };
      eventsCausingActions: { fooAction: 'FOO' };
      eventsCausingDelays: { barDelay: 'BAR' };
    }

    const machine = createMachine(
      {
        tsTypes: {} as TypesMeta,
        schema: {
          events: {} as { type: 'FOO' } | { type: 'BAR' } | { type: 'BAZ' }
        }
      },
      {
        delays: {
          barDelay: () => 42
        }
      }
    );

    function App() {
      useMachine(machine, {
        actions: {
          fooAction: () => {}
        },
        delays: {
          barDelay: () => 100
        }
      });
      return null;
    }

    render(<App />);
  });

  it('should accept a machine that accepts a specific subset of events in one of the implementations', () => {
    interface TypesMeta extends TypegenMeta {
      missingImplementations: {
        actions: never;
        services: never;
        guards: never;
        delays: never;
      };
      eventsCausingActions: {
        fooAction: 'FOO';
      };
    }

    const machine = createMachine({
      tsTypes: {} as TypesMeta,
      schema: {
        events: {} as { type: 'FOO' } | { type: 'BAR' }
      }
    });

    function App() {
      useMachine(machine, {
        actions: {
          // it's important to use `event` here somehow to make this a possible source of information for inference
          fooAction: (_context, _event) => {}
        }
      });
      return null;
    }

    render(<App />);
  });

  it('should provide subset of the event type to action objects given in the `options` argument', () => {
    interface TypesMeta extends TypegenMeta {
      missingImplementations: {
        actions: never;
        services: never;
        guards: never;
        delays: never;
      };
      eventsCausingActions: {
        fooAction: 'FOO';
      };
    }

    const machine = createMachine({
      tsTypes: {} as TypesMeta,
      schema: {
        events: {} as { type: 'FOO' } | { type: 'BAR' }
      }
    });

    function App() {
      useMachine(machine, {
        actions: {
          fooAction: assign((_context, _event) => {
            ((_accept: 'FOO') => {})(_event.type);
            // @ts-expect-error
            ((_accept: "test that this isn't any") => {})(_event.type);
          })
        }
      });
      return null;
    }

    render(<App />);
  });
});

describe('useInterpret', () => {
  it('should allow to be used with a machine without any missing implementations', () => {
    interface TypesMeta extends TypegenMeta {
      missingImplementations: {
        actions: never;
        delays: never;
        guards: never;
        services: never;
      };
    }

    const machine = createMachine({
      tsTypes: {} as TypesMeta
    });

    function App() {
      useInterpret(machine);
      return null;
    }

    render(<App />);
  });

  it('should not allow to be used with a machine with some missing implementations', () => {
    interface TypesMeta extends TypegenMeta {
      missingImplementations: {
        actions: 'myAction';
        delays: never;
        guards: never;
        services: never;
      };
      eventsCausingActions: {
        myAction: 'FOO';
      };
    }

    const machine = createMachine({
      tsTypes: {} as TypesMeta,
      schema: {
        events: {} as { type: 'FOO' } | { type: 'BAR' } | { type: 'BAZ' }
      }
    });

    function App() {
      // @ts-expect-error
      useInterpret(machine);
      return null;
    }

    render(<App />);
  });

  it('should require all missing implementations ', () => {
    interface TypesMeta extends TypegenMeta {
      missingImplementations: {
        actions: 'myAction';
        delays: 'myDelay';
        guards: never;
        services: never;
      };
      eventsCausingActions: {
        myAction: 'FOO';
        myDelay: 'BAR';
      };
    }

    const machine = createMachine({
      tsTypes: {} as TypesMeta,
      schema: {
        events: {} as { type: 'FOO' } | { type: 'BAR' } | { type: 'BAZ' }
      }
    });

    function App() {
      // @ts-expect-error
      useInterpret(machine, {});
      useInterpret(machine, {
        // @ts-expect-error
        actions: {}
      });
      // @ts-expect-error
      useInterpret(machine, {
        actions: {
          myAction: () => {}
        }
      });
      useInterpret(machine, {
        actions: {
          myAction: () => {}
        },
        delays: {
          myDelay: () => 42
        }
      });
      return null;
    }

    render(<App />);
  });

  it('should allow to override already provided implementation', () => {
    interface TypesMeta extends TypegenMeta {
      missingImplementations: {
        actions: 'fooAction';
        delays: never;
        guards: never;
        services: never;
      };
      eventsCausingActions: { fooAction: 'FOO' };
      eventsCausingDelays: { barDelay: 'BAR' };
    }

    const machine = createMachine(
      {
        tsTypes: {} as TypesMeta,
        schema: {
          events: {} as { type: 'FOO' } | { type: 'BAR' } | { type: 'BAZ' }
        }
      },
      {
        delays: {
          barDelay: () => 42
        }
      }
    );

    function App() {
      useInterpret(machine, {
        actions: {
          fooAction: () => {}
        },
        delays: {
          barDelay: () => 100
        }
      });
      return null;
    }

    render(<App />);
  });

  it('should accept a machine that accepts a specific subset of events in one of the implementations', () => {
    interface TypesMeta extends TypegenMeta {
      missingImplementations: {
        actions: never;
        services: never;
        guards: never;
        delays: never;
      };
      eventsCausingActions: {
        fooAction: 'FOO';
      };
    }

    const machine = createMachine({
      tsTypes: {} as TypesMeta,
      schema: {
        events: {} as { type: 'FOO' } | { type: 'BAR' }
      }
    });

    function App() {
      useInterpret(machine, {
        actions: {
          // it's important to use `event` here somehow to make this a possible source of information for inference
          fooAction: (_context, _event) => {}
        }
      });
      return null;
    }

    render(<App />);
  });

  it('should provide subset of the event type to action objects given in the `options` argument', () => {
    interface TypesMeta extends TypegenMeta {
      missingImplementations: {
        actions: never;
        services: never;
        guards: never;
        delays: never;
      };
      eventsCausingActions: {
        fooAction: 'FOO';
      };
    }

    const machine = createMachine({
      tsTypes: {} as TypesMeta,
      schema: {
        events: {} as { type: 'FOO' } | { type: 'BAR' }
      }
    });

    function App() {
      useInterpret(machine, {
        actions: {
          fooAction: assign((_context, _event) => {
            ((_accept: 'FOO') => {})(_event.type);
            // @ts-expect-error
            ((_accept: "test that this isn't any") => {})(_event.type);
          })
        }
      });
      return null;
    }

    render(<App />);
  });

  it('Should handle multiple state.matches when passed TypegenMeta', () => {
    interface TypesMeta extends TypegenMeta {
      matchesStates: 'a' | 'b';
      missingImplementations: {
        actions: never;
        services: never;
        guards: never;
        delays: never;
      };
    }

    const machine = createMachine({
      tsTypes: {} as TypesMeta
    });

    () => {
      const [state] = useMachine(machine, {});
      if (state.matches('a')) {
        return <div>a</div>;
      }

      // matches should still be defined
      if (state.matches('b')) {
        return <div>b</div>;
      }
    };
  });

  it('Should handle multiple state.matches when NOT passed TypegenMeta', () => {
    const machine = createMachine({});

    () => {
      const [state] = useMachine(machine, {});
      if (state.matches('a')) {
        return <div>a</div>;
      }

      // matches should still be defined
      if (state.matches('b')) {
        return <div>b</div>;
      }
    };
  });

  it('returned service created based on a lazy machine that supplies missing implementations using `withConfig` should be assignable to the ActorRefFrom<...> type', () => {
    interface TypesMeta extends TypegenMeta {
      missingImplementations: {
        actions: 'someAction';
        delays: never;
        guards: never;
        services: never;
      };
    }

    const machine = createMachine({
      tsTypes: {} as TypesMeta
    });

    function ChildComponent({}: { actorRef: ActorRefFrom<typeof machine> }) {
      return null;
    }

    function App() {
      const service = useInterpret(() =>
        machine.withConfig({
          actions: {
            someAction: () => {}
          }
        })
      );

      return <ChildComponent actorRef={service} />;
    }

    render(<App />);
  });

  it('returned service created based on a lazy machine that supplies missing implementations using `withConfig` should be assignable to the InterpreterFrom<...> type', () => {
    interface TypesMeta extends TypegenMeta {
      missingImplementations: {
        actions: 'someAction';
        delays: never;
        guards: never;
        services: never;
      };
    }

    const machine = createMachine({
      tsTypes: {} as TypesMeta
    });

    function ChildComponent({}: { actorRef: InterpreterFrom<typeof machine> }) {
      return null;
    }

    function App() {
      const service = useInterpret(() =>
        machine.withConfig({
          actions: {
            someAction: () => {}
          }
        })
      );

      return <ChildComponent actorRef={service} />;
    }

    render(<App />);
  });
});

describe('createActorContext', () => {
  it('should allow to be used with a machine without any missing implementations', () => {
    interface TypesMeta extends TypegenMeta {
      missingImplementations: {
        actions: never;
        delays: never;
        guards: never;
        services: never;
      };
    }

    const machine = createMachine({
      tsTypes: {} as TypesMeta
    });

    const Context = createActorContext(machine);

    function App() {
      return <Context.Provider>{null}</Context.Provider>;
    }

    render(<App />);
  });

  it('should not allow to be used with a machine with some missing implementations', () => {
    interface TypesMeta extends TypegenMeta {
      missingImplementations: {
        actions: 'myAction';
        delays: never;
        guards: never;
        services: never;
      };
      eventsCausingActions: {
        myAction: 'FOO';
      };
    }

    const machine = createMachine({
      tsTypes: {} as TypesMeta,
      schema: {
        events: {} as { type: 'FOO' } | { type: 'BAR' } | { type: 'BAZ' }
      }
    });

    const Context = createActorContext(machine);

    function App() {
      // @ts-expect-error
      return <Context.Provider>{null}</Context.Provider>;
    }

    render(<App />);
  });

  it('should require all missing implementations ', () => {
    interface TypesMeta extends TypegenMeta {
      missingImplementations: {
        actions: 'myAction';
        delays: 'myDelay';
        guards: never;
        services: never;
      };
      eventsCausingActions: {
        myAction: 'FOO';
        myDelay: 'BAR';
      };
    }

    const machine = createMachine({
      tsTypes: {} as TypesMeta,
      schema: {
        events: {} as { type: 'FOO' } | { type: 'BAR' } | { type: 'BAZ' }
      }
    });

    const Context = createActorContext(machine);

    function App() {
      let ret;
      // @ts-expect-error
      ret = <Context.Provider options={{}}>{null}</Context.Provider>;
      ret = (
        <Context.Provider
          options={{
            // @ts-expect-error
            actions: {}
          }}
        >
          {null}
        </Context.Provider>
      );
      ret = (
        <Context.Provider
          // @ts-expect-error
          options={{
            actions: {
              myAction: () => {}
            }
          }}
        >
          {null}
        </Context.Provider>
      );
      ret = (
        <Context.Provider
          options={{
            actions: {
              myAction: () => {}
            },
            delays: {
              myDelay: () => 42
            }
          }}
        >
          {null}
        </Context.Provider>
      );

      return ret;
    }

    render(<App />);
  });

  it('should allow to override already provided implementation', () => {
    interface TypesMeta extends TypegenMeta {
      missingImplementations: {
        actions: 'fooAction';
        delays: never;
        guards: never;
        services: never;
      };
      eventsCausingActions: { fooAction: 'FOO' };
      eventsCausingDelays: { barDelay: 'BAR' };
    }

    const machine = createMachine(
      {
        tsTypes: {} as TypesMeta,
        schema: {
          events: {} as { type: 'FOO' } | { type: 'BAR' } | { type: 'BAZ' }
        }
      },
      {
        delays: {
          barDelay: () => 42
        }
      }
    );

    const Context = createActorContext(machine);

    function App() {
      return (
        <Context.Provider
          options={{
            actions: {
              fooAction: () => {}
            },
            delays: {
              barDelay: () => 100
            }
          }}
        >
          {null}
        </Context.Provider>
      );
    }

    render(<App />);
  });

  it('should accept a machine that accepts a specific subset of events in one of the implementations', () => {
    interface TypesMeta extends TypegenMeta {
      missingImplementations: {
        actions: never;
        services: never;
        guards: never;
        delays: never;
      };
      eventsCausingActions: {
        fooAction: 'FOO';
      };
    }

    const machine = createMachine({
      tsTypes: {} as TypesMeta,
      schema: {
        events: {} as { type: 'FOO' } | { type: 'BAR' }
      }
    });

    const Context = createActorContext(machine);

    function App() {
      return (
        <Context.Provider
          options={{
            actions: {
              // it's important to use `event` here somehow to make this a possible source of information for inference
              fooAction: (_context, _event) => {}
            }
          }}
        >
          {null}
        </Context.Provider>
      );
    }

    render(<App />);
  });

  it('should provide subset of the event type to action objects given in the `options` argument', () => {
    interface TypesMeta extends TypegenMeta {
      missingImplementations: {
        actions: never;
        services: never;
        guards: never;
        delays: never;
      };
      eventsCausingActions: {
        fooAction: 'FOO';
      };
    }

    const machine = createMachine({
      tsTypes: {} as TypesMeta,
      schema: {
        events: {} as { type: 'FOO' } | { type: 'BAR' }
      }
    });

    const Context = createActorContext(machine);

    function App() {
      return (
        <Context.Provider
          options={{
            actions: {
              fooAction: assign((_context, _event) => {
                ((_accept: 'FOO') => {})(_event.type);
                // @ts-expect-error
                ((_accept: "test that this isn't any") => {})(_event.type);
              })
            }
          }}
        >
          {null}
        </Context.Provider>
      );
    }

    render(<App />);
  });

  it('returned service created based on a machine that supplies missing implementations using `withConfig` should be assignable to the ActorRefFrom<...> type', () => {
    interface TypesMeta extends TypegenMeta {
      missingImplementations: {
        actions: 'someAction';
        delays: never;
        guards: never;
        services: never;
      };
    }

    const machine = createMachine({
      tsTypes: {} as TypesMeta
    });

    const Context = createActorContext(
      machine.withConfig({
        actions: {
          someAction: () => {}
        }
      })
    );

    function GrandchildComponent({}: {
      actorRef: ActorRefFrom<typeof machine>;
    }) {
      return null;
    }

    function ChildComponent() {
      const actorRef = Context.useActorRef();
      return <GrandchildComponent actorRef={actorRef} />;
    }

    function App() {
      return (
        <Context.Provider>
          <ChildComponent />
        </Context.Provider>
      );
    }

    render(<App />);
  });
});
