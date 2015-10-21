
import assert from 'assert';
import should from 'should';
import {matchesState} from '../src/index';

describe('matchesState()', () => {

  it('should return true if two states are equivalent', () => {
    assert.ok(matchesState('a', 'a'));

    assert.ok(matchesState('b.b1', 'b.b1'));
  });

  it('should return true if a state is a substate of a superstate', () => {
    assert.ok(matchesState('b.b1', 'b'));

    assert.ok(matchesState('foo.bar.baz.quo', 'foo.bar'));
  });

  it('should return false if two states are not equivalent', () => {
    assert.ok(!matchesState('a', 'b'));

    assert.ok(!matchesState('a.a1', 'b.b1'));
  });

  it('should return false if a state is not a substate of a superstate', () => {
    assert.ok(!matchesState('b.b1', 'a'));

    assert.ok(!matchesState('foo.bar.baz.quo', 'foo.false.baz'));
  });

  it('should return false if either state or superstate is falsey', () => {
    assert.ok(!matchesState(false, 'a'));

    assert.ok(!matchesState('a', false));
  });
});
