import { createMachine } from '../src/index.ts';

describe('definition', () => {
  it('should provide invoke definitions', () => {
    const invokeMachine = createMachine({
      types: {} as {
        actors:
          | {
              src: 'foo';
            }
          | {
              src: 'bar';
            };
      },
      id: 'invoke',
      invoke: [{ src: 'foo' }, { src: 'bar' }],
      initial: 'idle',
      states: {
        idle: {}
      }
    });

    expect(invokeMachine.root.definition.invoke.length).toBe(2);
  });
});
