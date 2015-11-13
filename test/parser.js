import { inspect } from 'util';
import assert from 'assert';
import should from 'should';
import { parser } from '../src/index';

describe('parser', () => {

  it('should parse a simple state machine with the DSL', () => {
    let test = 'foo -> bar (baz)';

    let mapping = parser.parse(test);

    let expected = {
      states: [
        {
          id: 'foo',
          final: false,
          states: [],
          transitions: [
            {
              target: 'bar',
              event: 'baz'
            }
          ]
        }
      ]
    }

    console.log(inspect(mapping[0]), inspect(expected));

    assert.deepStrictEqual(mapping, expected);
  });
});
