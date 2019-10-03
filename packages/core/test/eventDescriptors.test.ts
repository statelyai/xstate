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

  it('should not use wildcard transition over explicit one when using object `.on` config - even if wildcard comes first', () => {
    const machine = Machine({
      initial: 'A',
      states: {
        A: {
          on: {
            '*': 'fail',
            NEXT: 'pass'
          }
        },
        fail: {},
        pass: {}
      }
    });

    const service = interpret(machine).start();
    service.send('NEXT');
    expect(service.state.value).toBe('pass');
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
