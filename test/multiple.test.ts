import { assert } from 'chai';
import { Machine } from '../src/index';

describe('multiple', () => {
  const machine = Machine({
    key: 'machine',
    initial: 'simple',
    states: {
      simple: {
        on: {
          DEEP_M: 'para.K.M',
          //DEEP_CMR_O: { para:  {states: { A: 'C', K: 'M', P: 'R' } } },
          DEEP_CMR: [{ target: ['para.A.C', 'para.K.M', 'para.P.R'] }],
          INITIAL: 'para'
        }
      },
      para: {
        parallel: true,
        states: {
          A: {
            initial: 'B',
            states: {
              B: {},
              C: {}
            }
          },
          K: {
            initial: 'L',
            states: {
              L: {},
              M: {}
            }
          },
          P: {
            initial: 'Q',
            states: {
              Q: {},
              R: {}
            }
          }
        }
      }
    }
  });

  describe('transitions to parallel states', () => {
    const stateSimple = machine.initialState;
    const stateInitial = machine.transition(stateSimple, 'INITIAL');
    const stateM = machine.transition(stateSimple, 'DEEP_M');

    it('should enter initial states of parallel states', () => {
      assert.deepEqual(stateInitial.value, {
        para: { A: 'B', K: 'L', P: 'Q' }
      });
    });

    it('should enter specific states in one region', () => {
      assert.deepEqual(stateM.value, { para: { A: 'B', K: 'M', P: 'Q' } });
    });

    it('should enter specific states in all regions', () => {
      const stateCMR = machine.transition(stateSimple, 'DEEP_CMR');
      assert.deepEqual(stateCMR.value, { para: { A: 'C', K: 'M', P: 'R' } });
    });
  });
});
