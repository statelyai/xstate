import { createHash } from 'node:crypto';
import { createMachine } from 'xstate';
import fixture from './fixtures/source-coverage.json' with { type: 'json' };
import { createSourceCoverageSession } from '../src/sourceCoverage.ts';

function load() {
  const exports: Record<string, any> = {};
  new Function('exports', 'createMachine', fixture.javascript)(
    exports,
    createMachine
  );
  return { machine: exports.machine, control: exports[fixture.controlExport] };
}
it('executes the exact source coverage protocol fixture shared with Viz and graph', async () => {
  expect(createHash('sha256').update(fixture.source).digest('hex')).toBe(
    fixture.manifest.source.hash
  );
  const { machine, control } = load();
  const hits = new Set<string>();
  for (const event of fixture.cases.filter((event) => event.type === 'PAY')) {
    const session = createSourceCoverageSession(machine, control, {
      runtimeId: 'xstate@conformance'
    });
    expect(session.initial.outcomeIds).toEqual([]);
    for (const id of (await session.step({ type: 'START' })).outcomeIds)
      hits.add(id);
    for (const id of (await session.step(event)).outcomeIds) hits.add(id);
  }
  expect([...hits].sort()).toEqual(
    fixture.manifest.obligations.map((o) => o.id).sort()
  );
  const paidOutcomes = fixture.manifest.obligations.filter((o) =>
    o.targets.includes('routing')
  );
  expect(paidOutcomes).toHaveLength(2);
  expect(paidOutcomes[0]!.id).not.toBe(paidOutcomes[1]!.id);
});
