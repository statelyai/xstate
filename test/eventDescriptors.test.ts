import { Machine, interpret } from '../src/index';
import { assert } from 'chai';

describe('event descriptors', () => {
  it('should fallback to using wildcard transition definition (if specified)', () => {
      const machine = Machine({
          initial: 'A',
          states: {
              A: {
                on: {
                    FOO: 'B',
                    '*': 'C',
                }
              },
              B: {},
              C: {}
          }
      });

      const service = interpret(machine).start()
      service.send('BAR')
      assert.equal(service.state.value, 'C')
  });
});
