import { StateTree } from '../src/StateTree';
import { Machine } from '../src';
import { assert } from 'chai';

const testMachine = Machine({
  id: 'test',
  initial: 'a',
  states: {
    a: {
      initial: 'one',
      states: {
        one: {},
        two: {
          type: 'final'
        }
      }
    },
    b: {
      type: 'parallel',
      states: {
        one: {
          initial: 'foo',
          states: { foo: {}, bar: { type: 'final' } }
        },
        two: {
          initial: 'foo',
          states: {
            foo: {
              initial: 'x',
              states: {
                x: {}
              }
            },
            bar: { type: 'final' }
          }
        }
      }
    },
    c: {
      initial: 'one',
      states: {
        one: {
          initial: 'aa',
          states: {
            aa: {
              initial: 'foo',
              states: { foo: {} }
            },
            bb: {
              initial: 'foo',
              states: { foo: {} }
            },
            cc: {}
          }
        },
        two: {
          initial: 'aa',
          states: {
            aa: {},
            bb: {},
            cc: {}
          }
        },
        three: {
          type: 'parallel',
          states: {
            aa: {
              initial: 'aaa',
              states: { aaa: {}, bbb: {} }
            },
            bb: {
              initial: 'aaa',
              states: { aaa: {}, bbb: {} }
            }
          }
        }
      }
    }
  }
});

describe('StateTree', () => {
  describe('.resolved', () => {
    it('represents the full value (compound)', () => {
      const st = new StateTree(testMachine, 'a').resolved;

      assert.deepEqual(st.value, { a: 'one' });
    });

    it('represents the full value (parallel)', () => {
      const st = new StateTree(testMachine, 'b').resolved;

      assert.deepEqual(st.value, {
        b: {
          one: 'foo',
          two: { foo: 'x' }
        }
      });
    });

    it('represents the full value (parallel deep)', () => {
      const st = new StateTree(testMachine, { b: 'two' }).resolved;

      assert.deepEqual(st.value, {
        b: {
          one: 'foo',
          two: { foo: 'x' }
        }
      });
    });
  });

  describe('.combine', () => {
    it('combines two state trees (compound)', () => {
      const st_c = new StateTree(testMachine, 'c');
      const st_c_two = new StateTree(testMachine, { c: 'two' });

      const combined = st_c.combine(st_c_two);

      assert.deepEqual(combined.value, { c: { two: {} } });
      assert.deepEqual(combined.resolved.value, { c: { two: 'aa' } });
    });
  });

  it('getEntryExitStates() should show correct entry/exit state nodes', () => {
    const st_A = new StateTree(testMachine, 'c').resolved; // { c: { one: 'aa' }}
    const st_B = new StateTree(testMachine, { c: { one: 'bb' } }).resolved;

    const res = st_B.getEntryExitStates(st_A);
    assert.deepEqual([...res.exit].map(n => n.id), [
      'test.c.one.aa.foo',
      'test.c.one.aa'
    ]);
    assert.deepEqual([...res.entry].map(n => n.id), [
      'test.c.one.bb',
      'test.c.one.bb.foo'
    ]);
  });

  it('only marks a tree as done when all parallel child nodes are in final states', () => {
    const myMachine = Machine({
      id: 'myId',
      type: 'parallel',
      states: {
        step1: {
          initial: 'incomplete',
          states: {
            incomplete: { on: { FIRST_COMPLETE: 'complete' } },
            complete: { type: 'final' }
          }
        },
        step2: {
          initial: 'incomplete',
          states: {
            incomplete: { on: { SECOND_COMPLETE: 'complete' } },
            complete: { type: 'final' }
          }
        }
      }
    });

    const firstCompleteState = myMachine.transition(
      myMachine.initialState,
      'FIRST_COMPLETE'
    );

    assert.isFalse(firstCompleteState.tree!.done);

    const secondCompleteState = myMachine.transition(
      firstCompleteState,
      'SECOND_COMPLETE'
    );

    assert.isTrue(secondCompleteState.tree!.done);

    // service.send('FIRST_COMPLETE')
    // expect(handleOnDone).not.toHaveBeenCalled()
  });
});
