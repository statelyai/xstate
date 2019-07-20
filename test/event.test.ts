import { Machine, sendParent, interpret } from '../src';
// import { assert } from 'chai';

describe('SCXML events', () => {
  it('should have the sendid from the sending service', done => {
    const childMachine = Machine({
      initial: 'active',
      states: {
        active: {
          entry: sendParent('EVENT')
        }
      }
    });

    const parentMachine = Machine({
      initial: 'active',
      states: {
        active: {
          invoke: {
            id: 'child',
            src: childMachine
          },
          on: {
            EVENT: {
              target: 'success',
              cond: (_, __, { _event }) => {
                return _event.sendid === 'child';
              }
            }
          }
        },
        success: {
          type: 'final'
        }
      }
    });

    interpret(parentMachine)
      .onDone(() => done())
      .start();
  });
});
