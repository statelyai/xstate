import { assert } from 'chai';
import { mapState } from '../src/index';

describe('mapState()', () => {
  it('should return the first mapping found of a state', () => {
    const mapping = mapState(
      {
        a: 'state a',
        b: 'state b'
      },
      'b'
    );

    assert.strictEqual(mapping, 'state b');
  });

  it('should return undefined for unmapped states', () => {
    const mapping = mapState(
      {
        a: 'state a',
        b: 'state b'
      },
      'c'
    );

    assert.isUndefined(mapping);
  });

  it('should prioritize returning equivalent state mapping', () => {
    const mapping = mapState(
      {
        a: 'state a',
        b: 'state b',
        'b.b1': 'st b.b1'
      },
      'b.b1'
    );

    assert.strictEqual(mapping, 'st b.b1');
  });

  it('should return superstate mapping when substate is not found', () => {
    const mapping = mapState(
      {
        a: 'state a',
        b: 'state b',
        'b.b1': 'st b.b1'
      },
      'b.foo'
    );

    assert.strictEqual(mapping, 'state b');
  });

  it('should return superstate mapping when deep substate is not found', () => {
    const mapping = mapState(
      {
        a: 'state a',
        b: 'state b',
        'b.b1': 'state b.b1'
      },
      'b.b1.foo'
    );

    assert.strictEqual(mapping, 'state b.b1');
  });
});
