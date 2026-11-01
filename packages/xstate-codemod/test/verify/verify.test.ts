import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { runBaseline, runVerify, verifyCli } from '../../src/verify/index.ts';
import type {
  EventCases,
  Stubs,
  VerifyReport
} from '../../src/verify/index.ts';

const fixtures = join(import.meta.dirname, 'fixtures');
const fixture = (name: string, file: string) => join(fixtures, name, file);
const readJson = (file: string) => JSON.parse(readFileSync(file, 'utf8'));

const cases: Array<{
  name: string;
  label?: string;
  events?: string;
  stubs?: string;
  field: string;
}> = [
  { name: 'traffic-light', field: 'context' },
  { name: 'counter', events: 'events.json', field: 'context' },
  {
    name: 'fetch',
    label: 'fetch (error stub)',
    stubs: 'stubs-error.json',
    field: 'value'
  },
  { name: 'parent-child', field: 'emitted' }
];

function unclassified(report: VerifyReport) {
  return report.diffs.filter((d) => d.classification === 'unclassified');
}

describe('verify (child processes)', { timeout: 60_000 }, () => {
  for (const { name, label, events, stubs, field } of cases) {
    const options = {
      events: events
        ? (readJson(fixture(name, events)) as EventCases)
        : undefined,
      stubs: stubs ? (readJson(fixture(name, stubs)) as Stubs) : undefined
    };

    it(`${label ?? name}: v5 and v6 are equivalent`, async () => {
      const report = await runVerify({
        v5: fixture(name, 'v5.ts'),
        file: fixture(name, 'v6.ts'),
        ...options
      });
      expect(report.error).toBeUndefined();
      expect(unclassified(report)).toEqual([]);
      expect(report.status).toBe('equivalent');
      expect(report.sequences).toBeGreaterThan(0);
      expect(report.v5.xstateVersion).toMatch(/^5\./);
      expect(report.v6.xstateVersion).toMatch(/^6\./);
    });

    it(`${label ?? name}: v6-broken diverges on ${field}`, async () => {
      const baseline = await runBaseline({
        file: fixture(name, 'v5.ts'),
        ...options
      });
      const first = await runVerify({
        baseline,
        file: fixture(name, 'v6-broken.ts')
      });
      const again = await runVerify({
        baseline,
        file: fixture(name, 'v6-broken.ts')
      });
      expect(first.status).toBe('diverged');
      const [diff] = unclassified(first);
      expect(diff.field).toBe(field);
      expect(diff.witness.length).toBeGreaterThan(0);
      expect(baseline.sequences.map((s) => s.id)).toContain(diff.sequenceId);
      expect(unclassified(again)[0].sequenceId).toBe(diff.sequenceId);
    });
  }

  it('fetch (done stub): broken onError target is not reached', async () => {
    const report = await runVerify({
      v5: fixture('fetch', 'v5.ts'),
      file: fixture('fetch', 'v6-broken.ts'),
      stubs: readJson(fixture('fetch', 'stubs-done.json'))
    });
    expect(report.status).toBe('equivalent');
  });

  it('payload-guard: a guard that throws without a payload is reported, not fatal', async () => {
    const baseline = await runBaseline({
      file: fixture('payload-guard', 'v5.ts')
    });
    expect(baseline.generationErrors.length).toBeGreaterThan(0);
    expect(baseline.generationErrors.join('\n')).toMatch(/PICK|paths skipped/);
    expect(baseline.sequences.length).toBeGreaterThan(0);
    const report = await runVerify({
      v5: fixture('payload-guard', 'v5.ts'),
      file: fixture('payload-guard', 'v6.ts')
    });
    expect(report.error).toBeUndefined();
    expect(report.status).toBe('equivalent');
    expect(report.generationErrors).toEqual(baseline.generationErrors);
  });

  it('final-output: top-level final output is an intentional delta', async () => {
    const report = await runVerify({
      v5: fixture('final-output', 'v5.ts'),
      file: fixture('final-output', 'v6.ts')
    });
    expect(report.error).toBeUndefined();
    expect(report.status).toBe('equivalent');
    expect(report.intentional).toBeGreaterThanOrEqual(1);
    expect(unclassified(report)).toEqual([]);
    const outputDiff = report.diffs.find((d) => d.field === 'output');
    expect(outputDiff?.classification).toMatchObject({
      rule: 'final-state-output'
    });
  });

  it('reports EXPORT_NOT_FOUND for a module without actor logic', async () => {
    const report = await runVerify({
      v5: fixture('traffic-light', 'v5.ts'),
      file: fixture('missing-export', 'v6.ts')
    });
    expect(report.status).toBe('error');
    expect(report.error).toMatchObject({
      phase: 'replay',
      code: 'EXPORT_NOT_FOUND'
    });
    expect(report.error!.message).toContain('notAMachine');
  });

  it('baseline is byte-identical for the same seed', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'xstate-verify-'));
    const stdout = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    const stderr = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    try {
      const outs = [join(dir, 'a.json'), join(dir, 'b.json')];
      for (const out of outs) {
        expect(
          await verifyCli([
            'baseline',
            fixture('traffic-light', 'v5.ts'),
            '--out',
            out,
            '--seed',
            '7'
          ])
        ).toBe(0);
      }
      expect(readFileSync(outs[0], 'utf8')).toBe(readFileSync(outs[1], 'utf8'));

      expect(
        await verifyCli([
          'verify',
          '--baseline',
          outs[0],
          fixture('traffic-light', 'v6.ts')
        ])
      ).toBe(0);
      expect(
        await verifyCli([
          'verify',
          '--baseline',
          outs[0],
          fixture('traffic-light', 'v6-broken.ts')
        ])
      ).toBe(3);
      expect(
        await verifyCli([
          'verify',
          '--baseline',
          outs[0],
          fixture('missing-export', 'v6.ts')
        ])
      ).toBe(4);
      expect(
        await verifyCli(['verify', fixture('traffic-light', 'v5.ts')])
      ).toBe(1);
    } finally {
      stdout.mockRestore();
      stderr.mockRestore();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
