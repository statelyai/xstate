import { assertEvent } from '../src/assertEvent';

describe('assertEvent', () => {
  type Event =
    | { type: 'EVENT_1'; data: number }
    | { type: 'EVENT_2'; data: string }
    | { type: 'EVENT_3'; data: boolean };

  it('allows asserting by string', () => {
    const e = { type: 'EVENT_1', data: 1 } as Event;
    assertEvent(e, 'EVENT_1');
    const data: number = e.data;
    expect(data).toEqual(1);
  });

  it('allows asserting by array', () => {
    const e = { type: 'EVENT_2', data: '1' } as Event;
    assertEvent(e, ['EVENT_2']);
    const data: string = e.data;
    expect(data).toEqual('1');
  });

  it('allows asserting to multiple ', () => {
    const e = { type: 'EVENT_3', data: true } as Event;
    assertEvent(e, ['EVENT_1', 'EVENT_3']);
    const data: number | boolean = e.data;
    expect(data).toEqual(true);
  });

  it('throws for single event assertion', () => {
    const e = { type: 'EVENT_3', data: true } as Event;
    expect(() => assertEvent(e, 'EVENT_1')).toThrow(
      'Expected event "EVENT_1" but got "EVENT_3".'
    );
  });

  it('throws for array event assertion', () => {
    const e = { type: 'EVENT_3', data: true } as Event;
    expect(() => assertEvent(e, ['EVENT_1', 'EVENT_2'])).toThrow(
      'Expected events "EVENT_1, EVENT_2" but got "EVENT_3".'
    );
  });
});
