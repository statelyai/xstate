import { inspect } from 'util';
import assert from 'assert';
import should from 'should';
import { parser } from '../src/index';

describe('parser', () => {

  it('should parse a simple state machine with the DSL', () => {
    let test = `
      foo -> bar (baz)
    `;

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
    };

    assert.deepStrictEqual(mapping, expected);
  });

  it('should parse multiple transitions', () => {
    let test = `
      foo
        -> bar (baz)
        -> one (two)
        -> three (four)
      bar
      one
      three
    `;

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
            },
            {
              target: 'one',
              event: 'two'
            },
            {
              target: 'three',
              event: 'four'
            }
          ]
        },
        {
          id: 'bar',
          final: false,
          states: [],
          transitions: []
        },
        {
          id: 'one',
          final: false,
          states: [],
          transitions: []
        },
        {
          id: 'three',
          final: false,
          states: [],
          transitions: []
        }
      ]
    };

    assert.deepStrictEqual(mapping, expected);
  });

  it('should parse cyclic transitions', () => {
    let traffic = `
      green -> yellow (TIMER)
      yellow -> red (TIMER)
      red -> green (TIMER)
    `;

    let mapping = parser.parse(traffic);

    let expected = {
      states: [
        {
          id: 'green',
          final: false,
          states: [],
          transitions: [
            {
              target: 'yellow',
              event: 'TIMER'
            }
          ]
        },
        {
          id: 'yellow',
          final: false,
          states: [],
          transitions: [
            {
              target: 'red',
              event: 'TIMER'
            }
          ]
        },
        {
          id: 'red',
          final: false,
          states: [],
          transitions: [
            {
              target: 'green',
              event: 'TIMER'
            }
          ]
        }
      ]
    };

    assert.deepStrictEqual(mapping, expected);
  });

  it('should parse nested states', () => {
    let nested = `
      parent {
        foo -> bar (BAZ)
        bar -> foo (BAZ)
      } -> other (EVENT)
    `;

    let expected = {
      states: [
        {
          id: 'parent',
          final: false,
          states: [
            {
              id: 'foo',
              final: false,
              states: [],
              transitions: [
                {
                  target: 'bar',
                  event: 'BAZ'
                }
              ]
            },
            {
              id: 'bar',
              final: false,
              states: [],
              transitions: [
                {
                  target: 'foo',
                  event: 'BAZ'
                }
              ]
            }
          ]
        }
      ];
    }
  })
});
