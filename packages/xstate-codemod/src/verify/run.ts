import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { RESULT_MARKER } from './child.ts';
import { DEFAULT_FIELDS, diffTraces } from './diff.ts';
import type {
  Baseline,
  ChildJob,
  ChildResult,
  EventCases,
  GenerateOptions,
  Stubs,
  VerifyReport
} from './types.ts';

const require = createRequire(import.meta.url);
// Resolved from this module, not cwd: the same lookup works from src and dist.
const packageRoot = dirname(require.resolve('@xstate/codemod/package.json'));

export const DEFAULT_OPTIONS: GenerateOptions = {
  seed: 1,
  walks: 25,
  steps: 12,
  maxSequences: 200
};
export const DEFAULT_TIMEOUT = 60_000;

export class VerifyError extends Error {
  phase: 'baseline' | 'replay';
  code: string;
  stderr: string;
  childStack: string | undefined;

  constructor(
    phase: 'baseline' | 'replay',
    code: string,
    message: string,
    stderr: string,
    childStack?: string
  ) {
    super(message);
    this.phase = phase;
    this.code = code;
    this.stderr = stderr;
    this.childStack = childStack;
  }
}

export async function runChild(
  major: 5 | 6,
  job: ChildJob,
  timeout = DEFAULT_TIMEOUT
): Promise<{ result: ChildResult; stderr: string }> {
  const args = [
    '--import',
    pathToFileURL(require.resolve('tsx')).href,
    '--import',
    pathToFileURL(join(packageRoot, 'bin/alias-hook.mjs')).href,
    join(packageRoot, 'bin/verify-child.mjs')
  ];
  return new Promise((done) => {
    const child = spawn(process.execPath, args, {
      cwd: dirname(job.file),
      env: { ...process.env, XSTATE_VERIFY_MAJOR: String(major) },
      stdio: ['pipe', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, timeout);
    child.stdout.setEncoding('utf8').on('data', (chunk) => (stdout += chunk));
    child.stderr.setEncoding('utf8').on('data', (chunk) => (stderr += chunk));
    child.on('close', (code) => {
      clearTimeout(timer);
      const at = stdout.lastIndexOf(RESULT_MARKER);
      let result: ChildResult;
      if (timedOut) {
        result = {
          ok: false,
          code: 'CHILD_TIMEOUT',
          message: `child timed out after ${timeout}ms`
        };
      } else if (at === -1) {
        // Node prints the fatal reason (e.g. heap out of memory) before the
        // native stack, so the first such line is the useful one.
        const fatal = stderr
          .split('\n')
          .find((line) => /FATAL ERROR|^\w*Error:/.test(line));
        result = {
          ok: false,
          code: 'CHILD_CRASH',
          message: `child exited with code ${code} without a result${fatal ? `: ${fatal.trim()}` : ''}`
        };
      } else {
        result = JSON.parse(stdout.slice(at + RESULT_MARKER.length));
      }
      done({ result, stderr });
    });
    child.stdin.end(JSON.stringify(job));
  });
}

export interface BaselineOptions extends Partial<GenerateOptions> {
  file: string;
  export?: string;
  events?: EventCases;
  stubs?: Stubs;
  timeout?: number;
}

/** Records a golden trace of a v5 module. Throws {@link VerifyError}. */
export async function runBaseline(options: BaselineOptions): Promise<Baseline> {
  const file = resolve(options.file);
  const generate: GenerateOptions = {
    seed: options.seed ?? DEFAULT_OPTIONS.seed,
    walks: options.walks ?? DEFAULT_OPTIONS.walks,
    steps: options.steps ?? DEFAULT_OPTIONS.steps,
    maxSequences: options.maxSequences ?? DEFAULT_OPTIONS.maxSequences
  };
  const events = options.events ?? {};
  const stubs = options.stubs ?? {};
  const { result, stderr } = await runChild(
    5,
    {
      mode: 'baseline',
      file,
      export: options.export,
      events,
      stubs,
      options: generate
    },
    options.timeout
  );
  if (!result.ok)
    throw new VerifyError(
      'baseline',
      result.code,
      result.message,
      stderr,
      result.stack
    );
  return {
    version: 1,
    file,
    export: result.export,
    xstateVersion: result.xstateVersion,
    options: generate,
    events,
    stubs,
    sequences: result.sequences,
    traces: result.traces,
    unstubbed: result.unstubbed,
    eventsWithoutCases: result.eventsWithoutCases,
    nonSerializable: result.nonSerializable
  };
}

export interface VerifyOptions extends Partial<GenerateOptions> {
  /** The v6 module to replay. */
  file: string;
  /** A v5 module to baseline first; ignored when `baseline` is given. */
  v5?: string;
  baseline?: Baseline;
  export?: string;
  /** Override the baseline's recorded cases/stubs. */
  events?: EventCases;
  stubs?: Stubs;
  /** Trace fields to compare; defaults to all but `actions`. */
  compare?: string[];
  timeout?: number;
}

/** Replays the baseline's sequences on a v6 module and diffs the traces. */
export async function runVerify(options: VerifyOptions): Promise<VerifyReport> {
  const file = resolve(options.file);
  const report: VerifyReport = {
    status: 'error',
    v5: {
      file: options.v5 ? resolve(options.v5) : '',
      export: '',
      xstateVersion: ''
    },
    v6: { file, export: '', xstateVersion: '' },
    sequences: 0,
    stepsCompared: 0,
    diffs: [],
    intentional: 0,
    unstubbed: [],
    eventsWithoutCases: [],
    nonSerializable: 0,
    notes: []
  };
  let baseline = options.baseline;
  if (!baseline) {
    if (!options.v5) throw new TypeError('runVerify needs `v5` or `baseline`');
    try {
      baseline = await runBaseline({ ...options, file: options.v5 });
    } catch (err) {
      if (!(err instanceof VerifyError)) throw err;
      report.error = {
        phase: err.phase,
        code: err.code,
        message: err.message,
        stack: err.childStack,
        stderr: err.stderr
      };
      return report;
    }
  } else {
    if (options.events)
      report.notes.push(
        '--events overrides the cases recorded in the baseline'
      );
    if (options.stubs)
      report.notes.push('--stubs overrides the stubs recorded in the baseline');
  }
  report.v5 = {
    file: baseline.file,
    export: baseline.export,
    xstateVersion: baseline.xstateVersion
  };
  report.sequences = baseline.sequences.length;
  report.eventsWithoutCases = baseline.eventsWithoutCases;

  const { result, stderr } = await runChild(
    6,
    {
      mode: 'replay',
      file,
      export: options.export,
      events: options.events ?? baseline.events,
      stubs: options.stubs ?? baseline.stubs,
      options: baseline.options,
      sequences: baseline.sequences
    },
    options.timeout
  );
  if (!result.ok) {
    report.error = {
      phase: 'replay',
      code: result.code,
      message: result.message,
      stack: result.stack,
      stderr
    };
    return report;
  }
  report.v6 = {
    file,
    export: result.export,
    xstateVersion: result.xstateVersion
  };
  report.unstubbed = [
    ...new Set([...baseline.unstubbed, ...result.unstubbed])
  ].sort();
  report.nonSerializable = baseline.nonSerializable + result.nonSerializable;
  const { diffs, stepsCompared } = diffTraces(
    baseline.sequences,
    baseline.traces,
    result.traces,
    options.compare ?? DEFAULT_FIELDS
  );
  report.diffs = diffs;
  report.stepsCompared = stepsCompared;
  report.intentional = diffs.filter(
    (d) => d.classification !== 'unclassified'
  ).length;
  report.status = diffs.length > report.intentional ? 'diverged' : 'equivalent';
  return report;
}
