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

  it('should select wildcard over explicit event type for array `.on` config (according to document order)', () => {
    const machine = Machine({
      initial: 'A',
      states: {
        A: {
          on: [
            { event: '*', target: 'pass' },
            { event: 'NEXT', target: 'fail' }
          ]
        },
        fail: {},
        pass: {}
      }
    });

    const service = interpret(machine).start();
    service.send('NEXT');
    expect(service.state.value).toBe('pass');
  });
});
