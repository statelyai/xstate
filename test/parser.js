import { inspect } from 'util';
import assert from 'assert';
import chai from 'chai';
import chaiSubset from 'chai-subset';
import { parse, machine } from '../src/index';

chai.use(chaiSubset);

describe('parser', () => {

  it('should parse a simple state machine with the DSL', () => {
    let test = `
      foo -> bar (baz)
    `;

    let mapping = parse(test);

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

    chai.assert.containSubset(mapping, expected);
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

    let mapping = parse(test);

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

    chai.assert.containSubset(mapping, expected);
  });

  it('should parse cyclic transitions', () => {
    let traffic = `
      green -> yellow (TIMER)
      yellow -> red (TIMER)
      red -> green (TIMER)
    `;

    let mapping = parse(traffic);

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

    chai.assert.containSubset(mapping, expected);
  });

  it('should parse nested states', () => {
    let nested = `
      parent {
        foo -> bar (BAZ)
        bar -> foo (BAZ)
      } -> second (FOO)
    `;

    let mapping = parse(nested);

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
          ],
          transitions: [
            {
              target: 'second',
              event: 'FOO'
            }
          ]
        }
      ]
    };

    chai.assert.containSubset(mapping, expected);
  });

  it('should parse deeply nested states', () => {
    let deeplyNested = `
      a { b { c -> d (E) }}
    `;

    let mapping = parse(deeplyNested);

    let expected = {
      states: [
        {
          id: 'a',
          final: false,
          states: [
            {
              id: 'b',
              final: false,
              states: [
                {
                  id: 'c',
                  final: false,
                  states: [],
                  transitions: [
                    {
                      target: 'd',
                      event: 'E'
                    }
                  ]
                }
              ],
              transitions: []
            }
          ],
          transitions: []
        }
      ]
    };

    chai.assert.containSubset(mapping, expected);
  });

  it('should handle varying levels of whitespace', () => {
    let tests = [
      `a->b(c)->d(e)`,
      `  a   ->  b  (c)    ->  d   (e)`,
      `
          a
              ->
              b
              (c)
              ->d
                    (e)
      `
    ];

    let expected = {
      states: [
        {
          id: 'a',
          final: false,
          states: [],
          transitions: [
            {
              target: 'b',
              event: 'c'
            },
            {
              target: 'd',
              event: 'e'
            }
          ]
        }
      ]
    };

    tests.forEach((test) => {
      chai.assert.containSubset(parse(test), expected);
    });
  });

  it('should identify final states', () => {
    let finalTest = `
      a -> b
      b!
    `;

    let mapping = parse(finalTest);
    let testMachine = machine(mapping);

    chai.assert.containSubset(testMachine.getState('a').final, false);
    chai.assert.containSubset(testMachine.getState('b').final, true);
  })
});
