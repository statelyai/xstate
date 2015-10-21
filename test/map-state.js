
import assert from 'assert';
import should from 'should';
import {mapState} from '../src/index';

describe('mapState()', () => {

  it('should return the first mapping found of a state', () => {
    let mapping = mapState({
      'a': 'state a',
      'b': 'state b'
    }, 'b');

    assert.strictEqual(mapping, 'state b');
  });

  it('should return null for unmapped states', () => {
    let mapping = mapState({
      'a': 'state a',
      'b': 'state b'
    }, 'c');

    assert.strictEqual(mapping, null);
  });

  it('should prioritize returning equivalent state mapping', () => {
    let mapping = mapState({
      'a': 'state a',
      'b': 'state b',
      'b.b1': 'st b.b1'
    }, 'b.b1');

    assert.strictEqual(mapping, 'st b.b1');
  });

  it('should return superstate mapping when substate is not found', () => {
    let mapping = mapState({
      'a': 'state a',
      'b': 'state b',
      'b.b1': 'st b.b1'
    }, 'b.foo');

    assert.strictEqual(mapping, 'state b');
  });

  it('should return superstate mapping when deep substate is not found', () => {
    let mapping = mapState({
      'a': 'state a',
      'b': 'state b',
      'b.b1': 'state b.b1'
    }, 'b.b1.foo');

    assert.strictEqual(mapping, 'state b.b1');
  });

  it('should be able to be curried', () => {
    let mappingFn = mapState({
      'a': 'state a',
      'b': 'state b'
    });

    assert.strictEqual(mappingFn('a'), 'state a');

    assert.strictEqual(mappingFn('b'), 'state b');
  });
});
