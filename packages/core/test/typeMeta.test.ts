import { interpret } from '../src';
import { createMachine } from '../src/Machine';
import { createModel } from '../src/model';
import { TypegenMeta } from '../src/typegenTypes';

// TODO: configure from the top if required stuff should be, well, required
// atm createMachine will expect all  missingImplementations to be provided

const doNotExecute = (_func: () => void) => {};

interface Context {}

type MyEvent =
  | {
      type: 'EVENT_1';
    }
  | {
      type: 'EVENT_2';
    }
  | {
      type: 'EVENT_3';
    };

describe('Type Meta', () => {
  describe('createModel', () => {
    it('should work with model.createMachine', () => {
      const model = createModel(
        {},
        {
          events: {
            EVENT_1: () => ({}),
            EVENT_2: () => ({}),
            EVENT_3: () => ({})
          }
        }
      );

      interface Meta extends TypegenMeta {
        missingImplementations: {
          actions: never;
          delays: never;
          guards: never;
          services: never;
        };
        eventsCausingServices: {
          myService: 'EVENT_1';
        };
      }

      model.createMachine(
        {
          types: {} as Meta
        },
        {
          services: {
            myService: async (_context, event) => {
              // @ts-expect-error
              event.type === 'EVENT_2';
              event.type === 'EVENT_1';
            }
          }
        }
      );
    });
  });
  describe('eventsCausingServices', () => {
    it('should track which events are causing which services', () => {
      doNotExecute(() => {
        interface Meta extends TypegenMeta {
          missingImplementations: {
            actions: never;
            delays: never;
            guards: never;
            services: never;
          };
          eventsCausingServices: {
            myService: 'EVENT_1';
          };
        }

        createMachine<Context, MyEvent, any, Meta>(
          {
            types: {} as Meta
          },
          {
            services: {
              myService: async (_context, event) => {
                // @ts-expect-error
                event.type === 'EVENT_2';
              }
            }
          }
        );
      });
    });
    it('should not allow unknown service names', () => {
      doNotExecute(() => {
        interface Meta extends TypegenMeta {
          missingImplementations: {
            actions: never;
            delays: never;
            guards: never;
            services: never;
          };
          eventsCausingServices: {
            myService: 'EVENT_1';
          };
        }

        createMachine<Context, MyEvent, any, Meta>(
          {
            types: {} as Meta
          },
          {
            services: {
              // @ts-expect-error
              awdawd: async () => {}
            }
          }
        );
      });
    });
    it('should not require missing service within createMachine call', () => {
      doNotExecute(() => {
        interface Meta extends TypegenMeta {
          missingImplementations: {
            actions: never;
            delays: never;
            guards: never;
            services: 'foo';
          };
          eventsCausingServices: {
            myService: 'EVENT_1';
          };
        }

        createMachine<Context, MyEvent, any, Meta>({
          types: {} as Meta
        });
        createMachine<Context, MyEvent, any, Meta>(
          {
            types: {} as Meta
          },
          {}
        );
        createMachine<Context, MyEvent, any, Meta>(
          {
            types: {} as Meta
          },
          {
            services: {}
          }
        );
      });
    });
  });

  describe('eventsCausingActions', () => {
    it('should track which events are causing which actions', () => {
      doNotExecute(() => {
        interface Meta extends TypegenMeta {
          missingImplementations: {
            actions: never;
            delays: never;
            guards: never;
            services: never;
          };
          eventsCausingActions: {
            myAction: 'EVENT_1';
          };
        }

        createMachine<Context, MyEvent, any, Meta>(
          {
            types: {} as Meta
          },
          {
            actions: {
              myAction: (_context, event) => {
                // @ts-expect-error
                event.type === 'EVENT_2';
              }
            }
          }
        );
      });
    });
    it('should not allow unknown action names', () => {
      doNotExecute(() => {
        interface Meta extends TypegenMeta {
          missingImplementations: {
            actions: never;
            delays: never;
            guards: never;
            services: never;
          };
          eventsCausingActions: {
            myAction: 'EVENT_1';
          };
        }

        createMachine<Context, MyEvent, any, Meta>(
          {
            types: {} as Meta
          },
          {
            actions: {
              // @ts-expect-error
              awdawd: async () => {}
            }
          }
        );
      });
    });
  });
  describe('eventsCausingGuards', () => {
    it('should track which events are causing which guards', () => {
      doNotExecute(() => {
        interface Meta extends TypegenMeta {
          missingImplementations: {
            actions: never;
            delays: never;
            guards: never;
            services: never;
          };
          eventsCausingGuards: {
            myGuard: 'EVENT_1';
          };
        }

        createMachine<Context, MyEvent, any, Meta>(
          {
            types: {} as Meta
          },
          {
            guards: {
              myGuard: (_context, event) => {
                // @ts-expect-error
                event.type === 'EVENT_2';
                return true;
              }
            }
          }
        );
      });
    });
    it('should not allow unknown guard names', () => {
      doNotExecute(() => {
        interface Meta extends TypegenMeta {
          missingImplementations: {
            actions: never;
            delays: never;
            guards: never;
            services: never;
          };
          eventsCausingGuards: {
            myAction: 'EVENT_1';
          };
        }

        createMachine<Context, MyEvent, any, Meta>(
          {
            types: {} as Meta
          },
          {
            guards: {
              // @ts-expect-error
              awdawd: () => {
                return true;
              }
            }
          }
        );
      });
    });
  });

  describe('allDelays', () => {
    it('should track which delays are used in the definition', () => {
      doNotExecute(() => {
        interface Meta extends TypegenMeta {
          missingImplementations: {
            actions: never;
            delays: never;
            guards: never;
            services: never;
          };
          eventsCausingDelays: {
            myDelay: 'EVENT_1';
          };
        }

        createMachine<Context, MyEvent, any, Meta>(
          {
            types: {} as Meta
          },
          {
            delays: {
              myDelay: (_context, event) => {
                // @ts-expect-error
                event.type === 'EVENT_2';
                return 1;
              }
            }
          }
        );
      });
    });
    it('should not allow unknown delay names', () => {
      doNotExecute(() => {
        interface Meta extends TypegenMeta {
          missingImplementations: {
            actions: never;
            delays: never;
            guards: never;
            services: never;
          };
          eventsCausingDelays: {
            myDelay: 'EVENT_1';
          };
        }

        createMachine<Context, MyEvent, any, Meta>(
          {
            types: {} as Meta
          },
          {
            delays: {
              // @ts-expect-error
              awdawd: () => {
                return 1;
              }
            }
          }
        );
      });
    });
  });

  describe('stateMatches', () => {
    it('should allow for specifying matchesStates', () => {
      doNotExecute(() => {
        interface Meta extends TypegenMeta {
          missingImplementations: {
            actions: never;
            delays: never;
            guards: never;
            services: never;
          };
          matchesStates: 'a' | 'b' | 'c';
        }

        const machine = createMachine<Context, MyEvent, any, Meta>({
          types: {} as Meta
        });

        // @ts-expect-error
        machine.initialState.matches('d');
      });
    });
  });

  describe('tags', () => {
    it('should allow for specifying tags', () => {
      doNotExecute(() => {
        interface Meta extends TypegenMeta {
          missingImplementations: {
            actions: never;
            delays: never;
            guards: never;
            services: never;
          };
          tags: 'a' | 'b' | 'c';
        }

        const machine = createMachine<Context, MyEvent, any, Meta>({
          types: {} as Meta
        });

        // @ts-expect-error
        machine.initialState.hasTag('d');
      });
    });
  });

  describe('withConfig', () => {
    it('should only require missing implementation type', () => {
      interface Meta extends TypegenMeta {
        missingImplementations: {
          actions: never;
          delays: never;
          guards: never;
          services: never;
        };
        optionsRequired?: 1;
        requiredActions: 'foo';
      }

      const machine = createMachine<Context, MyEvent, any, Meta>({
        types: {} as Meta
      });

      machine.withConfig({
        actions: {
          foo: () => {}
        }
      });
    });
  });

  describe('interpret', () => {
    it('should not allow to create service out of machine with missing implementations', () => {
      interface Meta extends TypegenMeta {
        missingImplementations: {
          actions: 'foo';
          delays: never;
          guards: never;
          services: never;
        };
      }

      const m = createMachine({
        types: {} as Meta
      });

      // @ts-expect-error
      interpret(m).start();
    });
  });
});
