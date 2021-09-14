import { createMachine } from '../../core/src';
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
          const machine = createMachine<Context, Event, Meta>({
            types: {} as Meta
          });

          const [state, send] = useInterpret(machine);
        });
      });
    });
    describe('If specified as 0', () => {
      it('Should NOT error if options are no passed in', () => {});
    });
  });
});
