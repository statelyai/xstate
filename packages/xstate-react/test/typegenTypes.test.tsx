import { render } from '@testing-library/react';
import { ActorRefFrom, assign, createMachine, TypegenMeta } from 'xstate';
import { createActorContext, useActorRef, useMachine } from '../src/index.ts';

describe('useMachine', () => {
  it('should allow to be used with a machine without any missing implementations', () => {
    interface TypesMeta extends TypegenMeta {
      missingImplementations: {
        actions: never;
        delays: never;
        guards: never;
        actors: never;
      };
    }

    const machine = createMachine({
      types: { typegen: {} as TypesMeta }
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
        actors: never;
      };
      eventsCausingActions: {
        myAction: 'FOO';
      };
    }

    const machine = createMachine({
      types: {
        typegen: {} as TypesMeta,
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
        actors: never;
      };
      eventsCausingActions: {
        myAction: 'FOO';
        myDelay: 'BAR';
      };
    }

    const machine = createMachine({
      types: {
        typegen: {} as TypesMeta,
        events: {} as { type: 'FOO' } | { type: 'BAR' } | { type: 'BAZ' }
      }
    });

    function App() {
      // @ts-expect-error
      useMachine(machine);
      useMachine(
        machine.provide({
          // @ts-expect-error
          actions: {}
        })
      );
      useMachine(
        // @ts-expect-error
        machine.provide({
          actions: {
            myAction: () => {}
          }
        })
      );
      useMachine(
        machine.provide({
          actions: {
            myAction: () => {}
          },
          delays: {
            myDelay: () => 42
          }
        })
      );
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
        actors: never;
      };
      eventsCausingActions: { fooAction: 'FOO' };
      eventsCausingDelays: { barDelay: 'BAR' };
    }

    const machine = createMachine(
      {
        types: {
          typegen: {} as TypesMeta,
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
      useMachine(
        machine.provide({
          actions: {
            fooAction: () => {}
          },
          delays: {
            barDelay: () => 100
          }
        })
      );
      return null;
    }

    render(<App />);
  });

  it('should accept a machine that accepts a specific subset of events in one of the implementations', () => {
    interface TypesMeta extends TypegenMeta {
      missingImplementations: {
        actions: never;
        actors: never;
        guards: never;
        delays: never;
      };
      eventsCausingActions: {
        fooAction: 'FOO';
      };
    }

    const machine = createMachine({
      types: {
        typegen: {} as TypesMeta,
        events: {} as { type: 'FOO' } | { type: 'BAR' }
      }
    });

    function App() {
      useMachine(
        machine.provide({
          actions: {
            // it's important to use `event` here somehow to make this a possible source of information for inference
            fooAction: () => {}
          }
        })
      );
      return null;
    }

    render(<App />);
  });

  it('should provide subset of the event type to action objects given in the `options` argument', () => {
    interface TypesMeta extends TypegenMeta {
      missingImplementations: {
        actions: never;
        actors: never;
        guards: never;
        delays: never;
      };
      eventsCausingActions: {
        fooAction: 'FOO';
      };
    }

    const machine = createMachine({
      types: {
        typegen: {} as TypesMeta,
        events: {} as { type: 'FOO' } | { type: 'BAR' }
      }
    });

    function App() {
      useMachine(
        machine.provide({
          actions: {
            fooAction: assign(({ event }) => {
              ((_accept: 'FOO') => {})(event.type);
              // @ts-expect-error
              ((_accept: "test that this isn't any") => {})(event.type);
            })
          }
        })
      );
      return null;
    }

    render(<App />);
  });
});

describe('useActorRef', () => {
  it('should allow to be used with a machine without any missing implementations', () => {
    interface TypesMeta extends TypegenMeta {
      missingImplementations: {
        actions: never;
        delays: never;
        guards: never;
        actors: never;
      };
    }

    const machine = createMachine({
      types: { typegen: {} as TypesMeta }
    });

    function App() {
      useActorRef(machine);
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
        actors: never;
      };
      eventsCausingActions: {
        myAction: 'FOO';
      };
    }

    const machine = createMachine({
      types: {
        typegen: {} as TypesMeta,
        events: {} as { type: 'FOO' } | { type: 'BAR' } | { type: 'BAZ' }
      }
    });

    function App() {
      // @ts-expect-error
      useActorRef(machine);
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
        actors: never;
      };
      eventsCausingActions: {
        myAction: 'FOO';
        myDelay: 'BAR';
      };
    }

    const machine = createMachine({
      types: {
        typegen: {} as TypesMeta,
        events: {} as { type: 'FOO' } | { type: 'BAR' } | { type: 'BAZ' }
      }
    });

    function App() {
      // @ts-expect-error
      useActorRef(machine, {});
      useActorRef(machine, {
        // @ts-expect-error
        actions: {}
      });
      // @ts-expect-error
      useActorRef(machine, {
        actions: {
          myAction: () => {}
        }
      });
      useActorRef(machine, {
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
        actors: never;
      };
      eventsCausingActions: { fooAction: 'FOO' };
      eventsCausingDelays: { barDelay: 'BAR' };
    }

    const machine = createMachine(
      {
        types: {
          typegen: {} as TypesMeta,
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
      useActorRef(machine, {
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
        actors: never;
        guards: never;
        delays: never;
      };
      eventsCausingActions: {
        fooAction: 'FOO';
      };
    }

    const machine = createMachine({
      types: {
        typegen: {} as TypesMeta,
        events: {} as { type: 'FOO' } | { type: 'BAR' }
      }
    });

    function App() {
      useActorRef(machine, {
        actions: {
          // it's important to use `event` here somehow to make this a possible source of information for inference
          fooAction: () => {}
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
        actors: never;
        guards: never;
        delays: never;
      };
      eventsCausingActions: {
        fooAction: 'FOO';
      };
    }

    const machine = createMachine({
      types: {
        typegen: {} as TypesMeta,
        events: {} as { type: 'FOO' } | { type: 'BAR' }
      }
    });

    function App() {
      useActorRef(
        machine.provide({
          actions: {
            fooAction: assign(({ event }) => {
              ((_accept: 'FOO') => {})(event.type);
              // @ts-expect-error
              ((_accept: "test that this isn't any") => {})(event.type);
            })
          }
        })
      );
      return null;
    }

    render(<App />);
  });

  it('Should handle multiple state.matches when passed TypegenMeta', () => {
    interface TypesMeta extends TypegenMeta {
      matchesStates: 'a' | 'b';
      missingImplementations: {
        actions: never;
        actors: never;
        guards: never;
        delays: never;
      };
    }

    const machine = createMachine({
      types: { typegen: {} as TypesMeta }
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

  it('returned actor created based on a machine that supplies missing implementations using `provide` should be assignable to the ActorRefFrom<...> type', () => {
    interface TypesMeta extends TypegenMeta {
      missingImplementations: {
        actions: 'someAction';
        delays: never;
        guards: never;
        actors: never;
      };
    }

    const machine = createMachine({
      types: { typegen: {} as TypesMeta }
    });

    function ChildComponent({}: { actorRef: ActorRefFrom<typeof machine> }) {
      return null;
    }

    function App() {
      const actorRef = useActorRef(
        machine.provide({
          actions: {
            someAction: () => {}
          }
        })
      );

      return <ChildComponent actorRef={actorRef} />;
    }

    render(<App />);
  });

  it('returned actor created based on a machine that supplies missing implementations using `provide` should be assignable to the ActorRefFrom<...> type', () => {
    interface TypesMeta extends TypegenMeta {
      missingImplementations: {
        actions: 'someAction';
        delays: never;
        guards: never;
        actors: never;
      };
    }

    const machine = createMachine({
      types: { typegen: {} as TypesMeta }
    });

    function ChildComponent({}: { actorRef: ActorRefFrom<typeof machine> }) {
      return null;
    }

    function App() {
      const actorRef = useActorRef(
        machine.provide({
          actions: {
            someAction: () => {}
          }
        })
      );

      return <ChildComponent actorRef={actorRef} />;
    }

    render(<App />);
  });
});

describe('createActorContext', () => {
  it('should allow to be used with a machine without any missing implementations', () => {
    interface TypesMeta extends TypegenMeta {
      missingImplementations: {
        actions: never;
        actors: never;
        delays: never;
        guards: never;
      };
    }

    const machine = createMachine({
      types: { typegen: {} as TypesMeta }
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
        actors: never;
        delays: never;
        guards: never;
      };
      eventsCausingActions: {
        myAction: 'FOO';
      };
    }

    const machine = createMachine({
      types: {
        typegen: {} as TypesMeta,
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
        actors: never;
        delays: 'myDelay';
        guards: never;
      };
      eventsCausingActions: {
        myAction: 'FOO';
        myDelay: 'BAR';
      };
    }

    const machine = createMachine({
      types: {
        typegen: {} as TypesMeta,
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
          machine={machine.provide({
            // @ts-expect-error
            actions: {}
          })}
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
          machine={machine.provide({
            actions: {
              myAction: () => {}
            },
            delays: {
              myDelay: () => 42
            }
          })}
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
        actors: never;
        delays: never;
        guards: never;
      };
      eventsCausingActions: { fooAction: 'FOO' };
      eventsCausingDelays: { barDelay: 'BAR' };
    }

    const machine = createMachine(
      {
        types: {
          typegen: {} as TypesMeta,
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
          machine={machine.provide({
            actions: {
              fooAction: () => {}
            },
            delays: {
              barDelay: () => 100
            }
          })}
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
        actors: never;
        guards: never;
        delays: never;
      };
      eventsCausingActions: {
        fooAction: 'FOO';
      };
    }

    const machine = createMachine({
      types: {
        typegen: {} as TypesMeta,
        events: {} as { type: 'FOO' } | { type: 'BAR' }
      }
    });

    const Context = createActorContext(machine);

    function App() {
      return (
        <Context.Provider
          machine={machine.provide({
            actions: {
              // it's important to use `event` here somehow to make this a possible source of information for inference
              fooAction: () => {}
            }
          })}
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
        actors: never;
        guards: never;
        delays: never;
      };
      eventsCausingActions: {
        fooAction: 'FOO';
      };
    }

    const machine = createMachine({
      types: {
        typegen: {} as TypesMeta,
        events: {} as { type: 'FOO' } | { type: 'BAR' }
      }
    });

    const Context = createActorContext(machine);

    function App() {
      return (
        <Context.Provider
          machine={machine.provide({
            actions: {
              fooAction: assign(({ event }) => {
                ((_accept: 'FOO') => {})(event.type);
                // @ts-expect-error
                ((_accept: "test that this isn't any") => {})(event.type);
              })
            }
          })}
        >
          {null}
        </Context.Provider>
      );
    }

    render(<App />);
  });

  it('returned actor created based on a machine that supplies missing implementations using `provide` should be assignable to the ActorRefFrom<...> type', () => {
    interface TypesMeta extends TypegenMeta {
      missingImplementations: {
        actions: 'someAction';
        actors: never;
        delays: never;
        guards: never;
      };
    }

    const machine = createMachine({
      types: { typegen: {} as TypesMeta }
    });

    const Context = createActorContext(
      machine.provide({
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
