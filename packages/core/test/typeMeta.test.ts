import { createMachine } from '../src/Machine';

const doNotExecute = (_func: () => void) => {};

interface Context {}

type Event =
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
  describe('eventsCausingServices', () => {
    it('Should track which events are causing which services', () => {
      doNotExecute(() => {
        interface Meta {
          __generated: 1;
          eventsCausingServices: {
            myService: 'EVENT_1';
          };
        }

        createMachine<Context, Event, Meta>(
          {
            types: {} as Meta
          },
          {
            services: {
              myService: async (context, event) => {
                // @ts-expect-error
                event.type === 'EVENT_2';
              }
            }
          }
        );
      });
    });
    it('Should not allow unknown service names', () => {
      doNotExecute(() => {
        interface Meta {
          __generated: 1;
          eventsCausingServices: {
            myService: 'EVENT_1';
          };
        }

        createMachine<Context, Event, Meta>(
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
  });

  describe('eventsCausingActions', () => {
    it('Should track which events are causing which actions', () => {
      doNotExecute(() => {
        interface Meta {
          __generated: 1;
          eventsCausingActions: {
            myAction: 'EVENT_1';
          };
        }

        createMachine<Context, Event, Meta>(
          {
            types: {} as Meta
          },
          {
            actions: {
              myAction: (context, event) => {
                // @ts-expect-error
                event.type === 'EVENT_2';
              }
            }
          }
        );
      });
    });
    it('Should not allow unknown action names', () => {
      doNotExecute(() => {
        interface Meta {
          __generated: 1;
          eventsCausingActions: {
            myAction: 'EVENT_1';
          };
        }

        createMachine<Context, Event, Meta>(
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
    it('Should track which events are causing which guards', () => {
      doNotExecute(() => {
        interface Meta {
          __generated: 1;
          eventsCausingGuards: {
            myGuard: 'EVENT_1';
          };
        }

        createMachine<Context, Event, Meta>(
          {
            types: {} as Meta
          },
          {
            guards: {
              myGuard: (context, event) => {
                // @ts-expect-error
                event.type === 'EVENT_2';
                return true;
              }
            }
          }
        );
      });
    });
    it('Should not allow unknown guard names', () => {
      doNotExecute(() => {
        interface Meta {
          __generated: 1;
          eventsCausingGuards: {
            myAction: 'EVENT_1';
          };
        }

        createMachine<Context, Event, Meta>(
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
    it('Should track which delays are used in the definition', () => {
      doNotExecute(() => {
        interface Meta {
          __generated: 1;
          allDelays: {
            myGuard: true;
          };
        }

        createMachine<Context, Event, Meta>(
          {
            types: {} as Meta
          },
          {
            delays: {
              myGuard: (context, event) => {
                // @ts-expect-error
                event.type === 'EVENT_2';
                return 1;
              }
            }
          }
        );
      });
    });
    it('Should not allow unknown delay names', () => {
      doNotExecute(() => {
        interface Meta {
          __generated: 1;
          allDelays: {
            myAction: true;
          };
        }

        createMachine<Context, Event, Meta>(
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
    it('Should allow for specifying matchesStates', () => {
      doNotExecute(() => {
        interface Meta {
          __generated: 1;
          matchesStates: 'a' | 'b' | 'c';
        }

        const machine = createMachine<Context, Event, Meta>({
          types: {} as Meta
        });

        // @ts-expect-error
        machine.initialState.matches('d');
      });
    });
  });

  describe('tags', () => {
    it('Should allow for specifying tags', () => {
      doNotExecute(() => {
        interface Meta {
          __generated: 1;
          tags: 'a' | 'b' | 'c';
        }

        const machine = createMachine<Context, Event, Meta>({
          types: {} as Meta
        });

        // @ts-expect-error
        machine.initialState.hasTag('d');
      });
    });
  });
});
