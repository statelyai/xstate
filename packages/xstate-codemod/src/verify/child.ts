import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { generateSequences, eventCandidates } from './generate.ts';
import { normalizeId, toJson } from './normalize.ts';
import { createRecorder5 } from './recorder5.ts';
import { createRecorder6 } from './recorder6.ts';
import { applyStubs } from './stubs.ts';
import type {
  ChildJob,
  ChildResult,
  Recorder,
  Sequence,
  Stats,
  Trace,
  TraceStep
} from './types.ts';

/** Marks the start of the JSON result on stdout; user code may print before it. */
export const RESULT_MARKER = '\n@@xstate-verify-result@@\n';

class ChildError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

const isLogic = (value: any) =>
  !!value &&
  typeof value.transition === 'function' &&
  typeof value.getInitialSnapshot === 'function';

async function loadLogic(
  file: string,
  name: string | undefined
): Promise<[string, any]> {
  let mod: Record<string, unknown>;
  try {
    mod = await import(pathToFileURL(file).href);
  } catch (err) {
    const error = err as Error;
    throw Object.assign(new ChildError('LOAD_ERROR', error.message), {
      stack: error.stack
    });
  }
  const names = Object.keys(mod);
  const found = name
    ? isLogic(mod[name]) && name
    : (isLogic(mod.default) && 'default') ||
      names.find((key) => isLogic(mod[key]));
  if (!found) {
    throw new ChildError(
      'EXPORT_NOT_FOUND',
      `${name ? `export "${name}" is not actor logic` : 'no actor logic export'} in ${file}; exports: ${names.join(', ') || '(none)'}`
    );
  }
  return [found, mod[found]];
}

const flush = async () => {
  for (let i = 0; i < 3; i++)
    await new Promise((resolve) => setImmediate(resolve));
};

async function recordTrace(
  xs: any,
  logic: any,
  sequence: Sequence,
  recorder: Recorder,
  stats: Stats
): Promise<Trace> {
  const clock = new xs.SimulatedClock();
  const actor = xs.createActor(logic, { clock, inspect: recorder.inspect });
  recorder.setRoot(actor);
  actor.subscribe({ error: () => {} });
  actor.on('*', recorder.emit);

  const capture = (input: TraceStep['input']): TraceStep => {
    const snapshot = actor.getSnapshot();
    const children = Object.values<any>(snapshot.children ?? {})
      .filter(Boolean)
      .map((ref) => ({ id: normalizeId(ref.id), src: recorder.srcOf(ref) }))
      .sort((a, b) => (a.id + a.src).localeCompare(b.id + b.src));
    const output = toJson(snapshot.output, stats);
    return {
      input,
      value: toJson(snapshot.value, stats),
      context: toJson(snapshot.context, stats) ?? null,
      status: snapshot.status,
      ...(output !== undefined && { output }),
      ...(snapshot.error !== undefined && { error: String(snapshot.error) }),
      ...recorder.take(),
      children
    };
  };

  actor.start();
  await flush();
  const steps = [capture({ start: true })];
  for (const step of sequence.steps) {
    if ('event' in step) actor.send(step.event);
    else clock.increment(step.advance);
    await flush();
    steps.push(capture(step));
  }
  actor.stop();
  return { sequenceId: sequence.id, steps };
}

async function runJob(job: ChildJob): Promise<ChildResult> {
  const major = process.env.XSTATE_VERIFY_MAJOR === '5' ? 5 : 6;
  // The alias hook maps `xstate` to the selected major for these imports too.
  const xs: any = await import('xstate');
  const xstateVersion: string = createRequire(import.meta.url)(
    'xstate/package.json'
  ).version;
  const [exportName, logic] = await loadLogic(job.file, job.export);
  const machine = applyStubs(xs, major, logic, job.stubs);
  const stats: Stats = { nonSerializable: 0 };

  let sequences = job.sequences ?? [];
  let eventsWithoutCases: string[] = [];
  if (job.mode === 'baseline') {
    const graph: any = await import('xstate/graph');
    const candidates = eventCandidates(machine, job.events);
    eventsWithoutCases = candidates.withoutCases;
    sequences = await generateSequences(
      xs,
      graph,
      machine,
      candidates.events,
      job.options
    );
  }

  const traces: Trace[] = [];
  const unstubbed = new Set<string>();
  for (const sequence of sequences) {
    const recorder =
      major === 5 ? createRecorder5(stats) : createRecorder6(stats);
    const trace = await recordTrace(xs, machine, sequence, recorder, stats);
    for (const step of trace.steps) {
      for (const child of step.children)
        if (child.src === '(inline)') unstubbed.add(child.id);
    }
    traces.push(trace);
  }
  return {
    ok: true,
    export: exportName,
    xstateVersion,
    sequences,
    traces,
    unstubbed: [...unstubbed].sort(),
    eventsWithoutCases,
    nonSerializable: stats.nonSerializable
  };
}

async function readStdin(): Promise<string> {
  let data = '';
  for await (const chunk of process.stdin) data += chunk;
  return data;
}

export async function childMain(): Promise<void> {
  let result: ChildResult;
  try {
    result = await runJob(JSON.parse(await readStdin()));
  } catch (err: any) {
    result = {
      ok: false,
      code: err instanceof ChildError ? err.code : 'RUN_ERROR',
      message: String(err?.message ?? err),
      stack: err?.stack
    };
  }
  process.stdout.write(RESULT_MARKER + JSON.stringify(result), () =>
    process.exit(0)
  );
}
