import { assert } from 'chai';
import { Machine } from '../src';

describe('definition', () => {
  it('should provide invoke definitions', () => {
    const invokeMachine = Machine({
      id: 'invoke',
      invoke: [{ src: 'foo' }, { src: 'bar' }],
      initial: 'idle',
      states: {
        idle: {}
      }
    });

    assert.lengthOf(invokeMachine.definition.invoke, 2);
  });
});
