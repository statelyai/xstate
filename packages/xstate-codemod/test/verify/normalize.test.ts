import { describe, expect, it } from 'vitest';
import {
  canonical,
  normalizeEvent,
  normalizeId,
  toJson
} from '../../src/verify/normalize.ts';

const stats = () => ({ nonSerializable: 0 });

describe('normalizeEvent', () => {
  it('maps v5 suffixed and v6 payload lifecycle events to one shape', () => {
    const s = stats();
    expect(
      normalizeEvent(
        { type: 'xstate.done.actor.user', output: 1, actorId: 'user' },
        s
      )
    ).toEqual(
      normalizeEvent(
        {
          type: 'xstate.done.actor',
          actorId: 'user',
          output: 1,
          sessionId: 'abc'
        },
        s
      )
    );
    expect(
      normalizeEvent(
        { type: 'xstate.error.actor.user', error: new Error('boom') },
        s
      )
    ).toEqual({
      type: 'xstate.error.actor',
      actorId: 'user',
      error: 'Error: boom'
    });
    expect(
      normalizeEvent({ type: 'xstate.after.1000.light.green' }, s)
    ).toEqual(
      normalizeEvent(
        { type: 'xstate.after', delay: 1000, stateId: 'light.green' },
        s
      )
    );
    expect(normalizeEvent({ type: 'xstate.done.state.m.a' }, s)).toEqual(
      normalizeEvent({ type: 'xstate.done.state', stateId: 'm.a' }, s)
    );
  });

  it('drops the v5 default root id "(machine)" from state ids', () => {
    const s = stats();
    expect(
      normalizeEvent({ type: 'xstate.after.10.(machine).nested.wait' }, s)
    ).toEqual(
      normalizeEvent(
        { type: 'xstate.after', delay: 10, stateId: 'nested.wait' },
        s
      )
    );
    expect(
      normalizeEvent({ type: 'xstate.done.state.(machine).a' }, s)
    ).toEqual(normalizeEvent({ type: 'xstate.done.state', stateId: 'a' }, s));
  });

  it('strips sessionId and keeps payloads', () => {
    expect(
      normalizeEvent({ type: 'INC', by: 2, sessionId: 'x' }, stats())
    ).toEqual({ type: 'INC', by: 2 });
  });
});

describe('normalizeId', () => {
  it('replaces generated ids from both majors', () => {
    expect(['x:3', '0.root.a', 'root.a:0', 'child:1'].map(normalizeId)).toEqual(
      Array(4).fill('(anon)')
    );
    expect(normalizeId('worker')).toBe('worker');
  });
});

describe('toJson', () => {
  it('marks functions and symbols and counts them', () => {
    const s = stats();
    expect(
      toJson({ f: () => {}, s: Symbol('x'), u: undefined, n: NaN }, s)
    ).toEqual({
      f: '[fn]',
      s: '[symbol]',
      n: null
    });
    expect(s.nonSerializable).toBe(2);
  });

  it('replaces actor refs and cycles', () => {
    const ref = { id: 'x:1', send() {}, getSnapshot() {} };
    const cyclic: any = { ref };
    cyclic.self = cyclic;
    expect(toJson(cyclic, stats())).toEqual({
      ref: { '@actor': '(anon)' },
      self: '[circular]'
    });
  });
});

it('canonical ignores key order', () => {
  expect(canonical({ a: 1, b: { c: 2, d: 3 } })).toBe(
    canonical({ b: { d: 3, c: 2 }, a: 1 })
  );
});
