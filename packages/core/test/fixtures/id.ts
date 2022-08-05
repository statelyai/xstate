import { AnyStateMachine, Machine } from '../../src';

export const machine: AnyStateMachine = Machine({
  initial: 'A',
  states: {
    A: {
      id: 'A',
      initial: 'foo',
      states: {
        foo: {
          id: 'A_foo',
          on: {
            NEXT: '#A_bar'
          }
        },
        bar: {
          id: 'A_bar',
          on: {
            NEXT: '#B_foo'
          }
        }
      }
    },
    B: {
      id: 'B',
      initial: 'foo',
      states: {
        foo: {
          id: 'B_foo',
          on: {
            NEXT: '#B_bar',
            NEXT_DOT: '#B.dot'
          }
        },
        bar: {
          id: 'B_bar',
          on: {
            NEXT: '#A_foo'
          }
        },
        dot_custom: {
          id: 'B.dot'
        }
      }
    },
    getter: {
      on: {
        get NEXT() {
          return machine.states.A;
        },
        get NEXT_DEEP() {
          return machine.states.A.states.foo;
        },
        NEXT_TARGET: {
          get target() {
            return machine.states.B;
          }
        },
        NEXT_TARGET_ARRAY: [
          {
            get target() {
              return machine.states.B;
            }
          }
        ]
      }
    }
  }
});
