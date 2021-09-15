import { createMachine } from 'xstate';
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
          interface Meta {
            __generated: 1;
            optionsRequired: 1;
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
          interface Meta {
            __generated: 1;
            optionsRequired: 0;
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
            interface Meta {
              __generated: 1;
              optionsRequired: 1;
              eventsCausingServices: {
                a: 'A';
              };
              requiredServices: 'a';
              eventsCausingGuards: {
                a: 'A';
              };
              requiredGuards: 'a';
              eventsCausingActions: {
                a: 'A';
              };
              requiredActions: 'a';
              allDelays: {
                a: true;
              };
              requiredDelays: 'a';
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
