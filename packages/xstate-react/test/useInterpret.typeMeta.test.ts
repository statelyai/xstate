import { createMachine, TypegenMeta } from 'xstate';
import { useInterpret } from '../src';

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

describe('useInterpret Type Meta', () => {
  describe('optionsRequired', () => {
    describe('If specified as 1', () => {
      it('Should error if options are not passed in', () => {
        doNotExecute(() => {
          interface Meta extends TypegenMeta {
            missingImplementations: {
              actions: 'foo';
              delays: never;
              guards: never;
              services: never;
            };
          }
          const machine = createMachine<Context, Event, any, Meta>({
            types: {} as Meta
          });

          // @ts-expect-error
          useInterpret(machine);
        });
      });
    });
    describe('If specified as 0', () => {
      it('Should NOT error if options are no passed in', () => {
        doNotExecute(() => {
          interface Meta extends TypegenMeta {
            missingImplementations: {
              actions: never;
              delays: never;
              guards: never;
              services: never;
            };
          }
          const machine = createMachine<Context, Event, any, Meta>({
            types: {} as Meta
          });

          useInterpret(machine);
        });
      });
    });
  });

  describe('requiredServices/Actions/Guards', () => {
    describe('If there is a required service, action, guard and delay', () => {
      it('Should ensure you pass all of them', () => {
        doNotExecute(() => {
          doNotExecute(() => {
            interface Meta extends TypegenMeta {
              missingImplementations: {
                actions: 'a';
                delays: 'a';
                guards: 'a';
                services: 'a';
              };
              eventsCausingServices: {
                a: 'A';
              };
              eventsCausingGuards: {
                a: 'A';
              };
              eventsCausingActions: {
                a: 'A';
              };
              eventsCausingDelays: {
                a: 'A';
              };
            }
            const machine = createMachine<Context, Event, any, Meta>({
              types: {} as Meta
            });

            /**
             * Test if each of services, actions, guards
             * and delays are each required
             */
            useInterpret(
              machine,
              // @ts-expect-error
              {
                services: {} as any,
                actions: {} as any,
                guards: {} as any
              }
            );
            useInterpret(
              machine,
              // @ts-expect-error
              {
                services: {} as any,
                actions: {} as any,
                delays: {} as any
              }
            );
            useInterpret(
              machine,
              // @ts-expect-error
              {
                delays: {} as any,
                actions: {} as any,
                guards: {} as any
              }
            );
            useInterpret(
              machine,
              // @ts-expect-error
              {
                services: {} as any,
                delays: {} as any,
                guards: {} as any
              }
            );

            /**
             * Test if each element within each category
             * is type checked
             */
            useInterpret(machine, {
              // @ts-expect-error
              services: {},
              // @ts-expect-error
              guards: {},
              // @ts-expect-error
              actions: {},
              // @ts-expect-error
              delays: {}
            });
          });
        });
      });
    });
  });
});
