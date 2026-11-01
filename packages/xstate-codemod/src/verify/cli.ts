import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parseArgs } from 'node:util';
import { DEFAULT_FIELDS } from './diff.ts';
import { runBaseline, runVerify, VerifyError } from './run.ts';
import type { Baseline, SequenceStep, VerifyReport } from './types.ts';

const USAGE = `Usage:
  xstate-codemod baseline <v5-file> [--out <path>] [options]
  xstate-codemod verify <v5-file> <v6-file> [options]
  xstate-codemod verify --baseline <path> <v6-file> [options]

Options:
  --export <name>        export to load (default: default, else first actor logic)
  --events <file>        event payload cases: { "TYPE": [payload, ...] }
  --stubs <file>         actor/delay stubs: { "actors": {...}, "delays": {...} }
  --seed <n>             random walk seed (default 1)
  --walks <n>            random walks (default 25)
  --steps <n>            steps per walk (default 12)
  --max-sequences <n>    sequence cap (default 200)
  --compare <fields>     fields to compare, or +field to add (e.g. +actions)
  --timeout <ms>         per child process (default 60000)
  --json                 print the JSON report only
`;

const readJson = (file: string) => JSON.parse(readFileSync(file, 'utf8'));
const show = (value: unknown) => JSON.stringify(value) ?? 'undefined';
const showStep = (step: SequenceStep) =>
  'event' in step ? `send ${show(step.event)}` : `advance ${step.advance}ms`;

function compareFields(value: string | undefined): string[] | undefined {
  if (!value) return undefined;
  const fields = value
    .split(',')
    .map((f) => f.trim())
    .filter(Boolean);
  const added = fields.filter((f) => f.startsWith('+')).map((f) => f.slice(1));
  const set = fields.filter((f) => !f.startsWith('+'));
  return [...(set.length ? set : DEFAULT_FIELDS), ...added];
}

function formatReport(report: VerifyReport): string {
  const lines = [`verify: ${report.status}`];
  lines.push(
    `  v5: ${report.v5.file} (export ${report.v5.export || '?'}, xstate ${report.v5.xstateVersion || '?'})`
  );
  lines.push(
    `  v6: ${report.v6.file} (export ${report.v6.export || '?'}, xstate ${report.v6.xstateVersion || '?'})`
  );
  if (report.error) {
    lines.push(
      `  error (${report.error.phase}): ${report.error.code}: ${report.error.message}`
    );
    if (report.error.stderr.trim())
      lines.push(`  stderr:\n${report.error.stderr.trimEnd()}`);
    return lines.join('\n') + '\n';
  }
  const unclassified = report.diffs.filter(
    (d) => d.classification === 'unclassified'
  );
  lines.push(
    `  sequences: ${report.sequences}, steps compared: ${report.stepsCompared}, unclassified diffs: ${unclassified.length}, intentional: ${report.intentional}`
  );
  if (report.unstubbed.length)
    lines.push(`  unstubbed inline actors: ${report.unstubbed.join(', ')}`);
  if (report.eventsWithoutCases.length)
    lines.push(
      `  events without cases: ${report.eventsWithoutCases.join(', ')}`
    );
  if (report.nonSerializable)
    lines.push(`  non-serializable values: ${report.nonSerializable}`);
  for (const note of report.notes) lines.push(`  note: ${note}`);
  unclassified.slice(0, 5).forEach((diff, i) => {
    lines.push(
      '',
      `Diff ${i + 1}: ${diff.sequenceId} (${diff.origin}) step ${diff.step}, field ${diff.field}`
    );
    lines.push('  witness:');
    if (!diff.witness.length) lines.push('    (start)');
    diff.witness.forEach((step, j) =>
      lines.push(`    ${j + 1}. ${showStep(step)}`)
    );
    lines.push(`  expected (v5): ${show(diff.expected)}`);
    lines.push(`  actual (v6):   ${show(diff.actual)}`);
  });
  return lines.join('\n') + '\n';
}

/** `baseline` and `verify` commands; `argv[0]` is the command name. */
export async function verifyCli(argv: string[]): Promise<number> {
  const [command, ...rest] = argv;
  let parsed;
  try {
    parsed = parseArgs({
      args: rest,
      allowPositionals: true,
      options: {
        out: { type: 'string' },
        baseline: { type: 'string' },
        export: { type: 'string' },
        events: { type: 'string' },
        stubs: { type: 'string' },
        seed: { type: 'string' },
        walks: { type: 'string' },
        steps: { type: 'string' },
        'max-sequences': { type: 'string' },
        compare: { type: 'string' },
        timeout: { type: 'string' },
        json: { type: 'boolean' },
        help: { type: 'boolean', short: 'h' }
      }
    });
  } catch (err) {
    process.stderr.write(`${(err as Error).message}\n${USAGE}`);
    return 1;
  }
  if (parsed.values.help) {
    process.stdout.write(USAGE);
    return 0;
  }
  const { values, positionals } = parsed;
  const int = (value: string | undefined) =>
    value === undefined ? undefined : Number.parseInt(value, 10);
  const common = {
    export: values.export,
    seed: int(values.seed),
    walks: int(values.walks),
    steps: int(values.steps),
    maxSequences: int(values['max-sequences']),
    timeout: int(values.timeout)
  };
  const numbers = [
    common.seed,
    common.walks,
    common.steps,
    common.maxSequences,
    common.timeout
  ];
  if (numbers.some((n) => n !== undefined && !Number.isFinite(n))) {
    process.stderr.write(`Numeric options must be integers\n${USAGE}`);
    return 1;
  }
  let events, stubs;
  try {
    events = values.events ? readJson(values.events) : undefined;
    stubs = values.stubs ? readJson(values.stubs) : undefined;
  } catch (err) {
    process.stderr.write(`${(err as Error).message}\n`);
    return 1;
  }

  if (command === 'baseline') {
    if (positionals.length !== 1) {
      process.stderr.write(USAGE);
      return 1;
    }
    let baseline: Baseline;
    try {
      baseline = await runBaseline({
        ...common,
        file: positionals[0],
        events,
        stubs
      });
    } catch (err) {
      if (!(err instanceof VerifyError)) throw err;
      process.stderr.write(
        `baseline: ${err.code}: ${err.message}\n${err.stderr}`
      );
      return 4;
    }
    const out =
      values.out ?? join('.xstate-migrate', `${baseline.export}.baseline.json`);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, JSON.stringify(baseline, null, 2) + '\n');
    if (values.json)
      process.stdout.write(
        JSON.stringify({ out, sequences: baseline.sequences.length }) + '\n'
      );
    else
      process.stdout.write(
        `baseline: ${baseline.sequences.length} sequences from ${baseline.file} (export ${baseline.export}) → ${out}\n`
      );
    return 0;
  }

  if (command === 'verify') {
    const expected = values.baseline ? 1 : 2;
    if (positionals.length !== expected) {
      process.stderr.write(USAGE);
      return 1;
    }
    let baseline: Baseline | undefined;
    try {
      baseline = values.baseline ? readJson(values.baseline) : undefined;
    } catch (err) {
      process.stderr.write(`${(err as Error).message}\n`);
      return 1;
    }
    const report = await runVerify({
      ...common,
      baseline,
      v5: baseline ? undefined : positionals[0],
      file: positionals[expected - 1],
      events,
      stubs,
      compare: compareFields(values.compare)
    });
    process.stdout.write(
      values.json
        ? JSON.stringify(report, null, 2) + '\n'
        : formatReport(report)
    );
    return report.status === 'equivalent'
      ? 0
      : report.status === 'diverged'
        ? 3
        : 4;
  }

  process.stderr.write(USAGE);
  return 1;
}
