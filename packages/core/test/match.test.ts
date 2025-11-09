import { matchesState, createMachine, createActor } from '../src/index.ts';

describe('matchesState()', () => {
  it('should return true if two states are equivalent', () => {
    expect(matchesState('a', 'a')).toBeTruthy();

    expect(matchesState('b.b1', 'b.b1')).toBeTruthy();

    expect(matchesState('B.bar', { A: 'foo' })).toBe(false);
  });

  it('should return true if two state values are equivalent', () => {
    expect(matchesState({ a: 'b' }, { a: 'b' })).toBeTruthy();
    expect(matchesState({ a: { b: 'c' } }, { a: { b: 'c' } })).toBeTruthy();
  });

  it('should return true if two parallel states are equivalent', () => {
    expect(
      matchesState(
        { a: { b1: 'foo', b2: 'bar' } },
        { a: { b1: 'foo', b2: 'bar' } }
      )
    ).toBeTruthy();

    expect(
      matchesState(
        { a: { b1: 'foo', b2: 'bar' }, b: { b3: 'baz', b4: 'quo' } },
        { a: { b1: 'foo', b2: 'bar' }, b: { b3: 'baz', b4: 'quo' } }
      )
    ).toBeTruthy();

    expect(
      matchesState({ a: 'foo', b: 'bar' }, { a: 'foo', b: 'bar' })
    ).toBeTruthy();
  });

  it('should return true if a state is a substate of a superstate', () => {
    expect(matchesState('b', 'b.b1')).toBeTruthy();

    expect(matchesState('foo.bar', 'foo.bar.baz.quo')).toBeTruthy();
  });

  it('should return true if a state value is a substate of a superstate value', () => {
    expect(matchesState('b', { b: 'b1' })).toBeTruthy();

    expect(
      matchesState({ foo: 'bar' }, { foo: { bar: { baz: 'quo' } } })
    ).toBeTruthy();
  });

  it('should return true if a parallel state value is a substate of a superstate value', () => {
    expect(matchesState('b', { b: 'b1', c: 'c1' })).toBeTruthy();

    expect(
      matchesState(
        { foo: 'bar', fooAgain: 'barAgain' },
        { foo: { bar: { baz: 'quo' } }, fooAgain: { barAgain: 'baz' } }
      )
    ).toBeTruthy();
  });

  it('should return false if two states are not equivalent', () => {
    expect(!matchesState('a', 'b')).toBeTruthy();

    expect(!matchesState('a.a1', 'b.b1')).toBeTruthy();
  });

  it('should return false if parent state is more specific than child state', () => {
    expect(!matchesState('a.b.c', 'a.b')).toBeTruthy();

    expect(!matchesState({ a: { b: { c: 'd' } } }, { a: 'b' })).toBeTruthy();
  });

  it('should return false if two state values are not equivalent', () => {
    expect(!matchesState({ a: 'a1' }, { b: 'b1' })).toBeTruthy();
  });

  it('should return false if a state is not a substate of a superstate', () => {
    expect(!matchesState('a', 'b.b1')).toBeTruthy();

    expect(!matchesState('foo.false.baz', 'foo.bar.baz.quo')).toBeTruthy();
  });

  it('should return false if a state value is not a substate of a superstate value', () => {
    expect(!matchesState('a', { b: 'b1' })).toBeTruthy();

    expect(
      !matchesState({ foo: { false: 'baz' } }, { foo: { bar: { baz: 'quo' } } })
    ).toBeTruthy();
  });

  it('should mix/match string state values and object state values', () => {
    expect(matchesState('a.b.c', { a: { b: 'c' } })).toBeTruthy();
  });
});

describe('matches() method', () => {
  it('should execute matchesState on a State given the parent state value', () => {
    const machine = createMachine({
      initial: 'foo',
      states: {
        foo: {
          initial: 'bar',
          states: {
            bar: {
              initial: 'baz',
              states: {
                baz: {}
              }
            }
          }
        }
      }
    });

    const initialState = createActor(machine).getSnapshot();

    expect(initialState.matches('foo')).toBeTruthy();
    expect(initialState.matches({ foo: 'bar' })).toBeTruthy();
    expect(initialState.matches('fake')).toBeFalsy();
  });
});
