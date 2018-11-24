import { machine as idMachine } from './fixtures/id';
import { testAll } from './utils';

describe('State node IDs', () => {
  const expected = {
    A: {
      NEXT: 'A.bar'
    },
    '#A': {
      NEXT: 'A.bar'
    },
    'A.foo': {
      NEXT: 'A.bar'
    },
    '#A_foo': {
      NEXT: 'A.bar'
    },
    'A.bar': {
      NEXT: 'B.foo'
    },
    '#A_bar': {
      NEXT: 'B.foo'
    },
    'B.foo': {
      'NEXT,NEXT': 'A.foo',
      NEXT_DOT: 'B.dot'
    },
    '#B_foo': {
      'NEXT,NEXT': 'A.foo'
    },

    // With getters
    getter: {
      NEXT: 'A',
      NEXT_DEEP: 'A.foo',
      NEXT_TARGET: 'B',
      NEXT_TARGET_ARRAY: 'B'
    }
  };

  testAll(idMachine, expected);
});
