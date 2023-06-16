import { defineComponent } from 'vue';
import { ActorRefFrom, assign, createMachine, TypegenMeta } from 'xstate';
import { useActorRef, useMachine } from '../src/index.ts';

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

    defineComponent({
      setup() {
        useMachine(machine);
      }
    });
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

    defineComponent({
      setup() {
        // @ts-expect-error
        useMachine(machine);
        return null;
      }
    });
  });

  it('should require all missing implementations', () => {
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

    defineComponent({
      setup: () => {
        // @ts-expect-error
        useMachine(machine, {});
        useMachine(
          machine.provide({
            // @ts-expect-error
            actions: {}
          })
        );
        // @ts-expect-error
        useMachine(machine, {
          actions: {
            myAction: () => {}
          }
        });
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
      }
    });
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

    defineComponent({
      setup: () => {
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
      }
    });
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

    defineComponent({
      setup: () => {
        useMachine(
          machine.provide({
            actions: {
              // it's important to use `event` here somehow to make this a possible source of information for inference
              fooAction: ({ event: _event }) => {}
            }
          })
        );
      }
    });
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

    defineComponent({
      setup: () => {
        useMachine(
          machine.provide({
            actions: {
              fooAction: assign(({ event }) => {
                ((_accept: 'FOO') => {})(event.type);
                // @ts-expect-error
                ((_accept: "test that this isn't any") => {})(_event.type);
              })
            }
          })
        );
      }
    });
  });
});

describe('useInterpret', () => {
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

    defineComponent({
      setup: () => {
        useActorRef(machine);
      }
    });
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

    defineComponent({
      setup: () => {
        // @ts-expect-error
        useActorRef(machine);
      }
    });
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

    defineComponent({
      setup: () => {
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
      }
    });
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

    defineComponent({
      setup: () => {
        useActorRef(machine, {
          actions: {
            fooAction: () => {}
          },
          delays: {
            barDelay: () => 100
          }
        });
      }
    });
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

    defineComponent({
      setup: () => {
        useActorRef(machine, {
          actions: {
            // it's important to use `event` here somehow to make this a possible source of information for inference
            // TODO: is it though?
            fooAction: () => {}
          }
        });
      }
    });
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

    defineComponent({
      setup: () => {
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
      }
    });
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

    defineComponent({
      setup: () => {
        const { snapshot: state } = useMachine(machine, {});
        if (state.value.matches('a')) {
          return { a: 1 };
        }

        // matches should still be defined
        if (state.value.matches('b')) {
          return { b: 1 };
        }
      }
    });
  });

  it('Should handle multiple state.matches when NOT passed TypegenMeta', () => {
    const machine = createMachine({});

    defineComponent({
      setup: () => {
        const { snapshot: state } = useMachine(machine, {});
        if (state.value.matches('a')) {
          return { a: 1 };
        }

        // matches should still be defined
        if (state.value.matches('b')) {
          return { b: 1 };
        }
      }
    });
  });

  it('returned service created based on a machine that supplies missing implementations using `withConfig` should be assignable to the ActorRefFrom<...> type', () => {
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

    function useMyActor(_actor: ActorRefFrom<typeof machine>) {}

    defineComponent({
      setup() {
        const service = useActorRef(
          machine.provide({
            actions: {
              someAction: () => {}
            }
          })
        );
        useMyActor(service);
        return {};
      }
    });
  });

  it('returned service created based on a machine that supplies missing implementations using `withConfig` should be assignable to the ActorRefFrom<...> type', () => {
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

    function useMyActor(_actor: ActorRefFrom<typeof machine>) {}

    defineComponent({
      setup() {
        const service = useActorRef(
          machine.provide({
            actions: {
              someAction: () => {}
            }
          })
        );
        useMyActor(service);
        return {};
      }
    });
  });
});
