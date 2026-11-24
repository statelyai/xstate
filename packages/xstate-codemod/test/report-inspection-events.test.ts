import { describe, expect, it } from 'vitest';
import { reportInspectionEvents } from '../src/transforms/report-inspection-events.ts';
import { applyTransform } from './helpers.ts';

describe('report-inspection-events', () => {
  it('reports v5 inspection event types in any file and never mutates', () => {
    const input = `const TRACKED = ['@xstate.event', '@xstate.action'];
export function inspect(ev: any) {
  if (ev.type === '@xstate.snapshot') log(ev.snapshot);
  if (ev.type === '@xstate.transition') log(ev.event);
  if (TRACKED.includes(ev.type)) log(ev);
  switch (ev.type) {
    case \`@xstate.deadletter\`:
      warn(ev);
  }
}`;
    const { output, changed, sites } = applyTransform(
      reportInspectionEvents,
      input,
      'src/devtools.js'
    );

    expect(changed).toBe(false);
    expect(output).toBe(input);
    expect(sites.map((s) => [s.api, s.line, s.column])).toEqual([
      ['@xstate.event', 1, 18],
      ['@xstate.action', 1, 35],
      ['@xstate.snapshot', 3, 19],
      ['@xstate.deadletter', 7, 10]
    ]);
    expect(sites[2].hint).toContain('`@xstate.transition`');
    expect(sites[3].hint).toContain('onRejectedEvent');
  });

  it('ignores v6 inspection types and unrelated strings', () => {
    const input = `const a = '@xstate.actor';
const b = '@xstate.transition';
const c = '@xstate.snapshots';`;
    expect(
      applyTransform(reportInspectionEvents, input, 'src/x.ts').sites
    ).toEqual([]);
  });
});
