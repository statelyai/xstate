import { Machine, interpret } from '../src/index';

describe('event descriptors', () => {
  it('should fallback to using wildcard transition definition (if specified)', () => {
    const machine = Machine({
      initial: 'A',
      states: {
        A: {
          on: {
            FOO: 'B',
            '*': 'C'
          }
        },
        B: {},
        C: {}
      }
    });

    const service = interpret(machine).start();
    service.send('BAR');
    expect(service.state.value).toBe('C');
  });
});
