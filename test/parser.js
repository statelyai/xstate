import { inspect } from 'util';
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
        },
        {
          id: 'one',
        },
        {
          id: 'three',
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
          transitions: [
            {
              target: 'yellow',
              event: 'TIMER'
            }
          ]
        },
        {
          id: 'yellow',
          transitions: [
            {
              target: 'red',
              event: 'TIMER'
            }
          ]
        },
        {
          id: 'red',
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
          states: [
            {
              id: 'foo',
              transitions: [
                {
                  target: 'bar',
                  event: 'BAZ'
                }
              ]
            },
            {
              id: 'bar',
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
          states: [
            {
              id: 'b',
              states: [
                {
                  id: 'c',
                  transitions: [
                    {
                      target: 'd',
                      event: 'E'
                    }
                  ]
                }
              ]
            }
          ]
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

  it('should identify initial states implicitly', () => {
    let initialTest = `
      a -> b
      b -> c
    `;

    let mapping = parse(initialTest);

    chai.assert.containSubset(mapping.states[0], { initial: true });
    chai.assert.containSubset(mapping.states[1], { initial: false });
  });

  it('should identify final states', () => {
    let finalTest = `
      a -> b
      b!
    `;

    let mapping = parse(finalTest);

    chai.assert.containSubset(mapping.states[0], { final: false });
    chai.assert.containSubset(mapping.states[1], { final: true });
  });
});
