import { defineComponent } from 'vue';
import {
  ActorRefFrom,
  assign,
  createMachine,
  InterpreterFrom,
  TypegenMeta
} from 'xstate';
import { useInterpret, useMachine } from '../src';

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

    defineComponent({
      setup() {
        // @ts-expect-error
        useMachine(machine);
        return null;
      }
    });
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

    defineComponent({
      setup: () => {
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
      }
    });
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

    defineComponent({
      setup: () => {
        useMachine(machine, {
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

    defineComponent({
      setup: () => {
        useMachine(machine, {
          actions: {
            // it's important to use `event` here somehow to make this a possible source of information for inference
            fooAction: (_context, _event) => {}
          }
        });
      }
    });
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

    defineComponent({
      setup: () => {
        useMachine(machine, {
          actions: {
            fooAction: assign((_context, _event) => {
              ((_accept: 'FOO') => {})(_event.type);
              // @ts-expect-error
              ((_accept: "test that this isn't any") => {})(_event.type);
            })
          }
        });
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
        services: never;
      };
    }

    const machine = createMachine({
      tsTypes: {} as TypesMeta
    });

    defineComponent({
      setup: () => {
        useInterpret(machine);
      }
    });
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

    defineComponent({
      setup: () => {
        // @ts-expect-error
        useInterpret(machine);
      }
    });
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

    defineComponent({
      setup: () => {
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
      }
    });
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

    defineComponent({
      setup: () => {
        useInterpret(machine, {
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

    defineComponent({
      setup: () => {
        useInterpret(machine, {
          actions: {
            // it's important to use `event` here somehow to make this a possible source of information for inference
            fooAction: (_context, _event) => {}
          }
        });
      }
    });
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

    defineComponent({
      setup: () => {
        useInterpret(machine, {
          actions: {
            fooAction: assign((_context, _event) => {
              ((_accept: 'FOO') => {})(_event.type);
              // @ts-expect-error
              ((_accept: "test that this isn't any") => {})(_event.type);
            })
          }
        });
      }
    });
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

    defineComponent({
      setup: () => {
        const { state } = useMachine(machine, {});
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
        const { state } = useMachine(machine, {});
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
        services: never;
      };
    }

    const machine = createMachine({
      tsTypes: {} as TypesMeta
    });

    function useMyActor(_actor: ActorRefFrom<typeof machine>) {}

    defineComponent({
      setup() {
        const service = useInterpret(
          machine.withConfig({
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

  it('returned service created based on a machine that supplies missing implementations using `withConfig` should be assignable to the InterpreterFrom<...> type', () => {
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

    function useMyActor(_actor: InterpreterFrom<typeof machine>) {}

    defineComponent({
      setup() {
        const service = useInterpret(
          machine.withConfig({
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
