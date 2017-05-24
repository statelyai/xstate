
import { assert } from 'chai';
import { matchesState } from '../src/index';

describe('matchesState()', () => {

  it('should return true if two states are equivalent', () => {
    assert.ok(matchesState('a', 'a'));

    assert.ok(matchesState('b.b1', 'b.b1'));
  });

  it('should return true if a state is a substate of a superstate', () => {
    assert.ok(matchesState('b', 'b.b1'));

    assert.ok(matchesState('foo.bar', 'foo.bar.baz.quo'));
  });

  it('should return false if two states are not equivalent', () => {
    assert.ok(!matchesState('a', 'b'));

    assert.ok(!matchesState('a.a1', 'b.b1'));
  });

  it('should return false if a state is not a substate of a superstate', () => {
    assert.ok(!matchesState('a', 'b.b1'));

    assert.ok(!matchesState('foo.false.baz', 'foo.bar.baz.quo'));
  });

  it('should compare state paths', () => {
    assert.ok(matchesState(['a'], ['a']));
    assert.ok(matchesState(['a'], ['a', 'b']));    

    assert.ok(matchesState(['b', 'b1'], ['b', 'b1', 'b2', 'b3']));
  });
});
