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

    expect(invokeMachine.definition.invoke.length).toBe(2);
  });
});
