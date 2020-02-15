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

    expect(mapping).toBe('state b');
  });

  it('should return undefined for unmapped states', () => {
    const mapping = mapState(
      {
        a: 'state a',
        b: 'state b'
      },
      'c'
    );

    expect(mapping).not.toBeDefined();
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

    expect(mapping).toBe('st b.b1');
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

    expect(mapping).toBe('state b');
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

    expect(mapping).toBe('state b.b1');
  });
});
