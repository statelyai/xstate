export type EventObject = { type: string; [key: string]: unknown };
export type NormalizedEvent = EventObject;

export type SequenceStep = { event: EventObject } | { advance: number };
export type Origin = 'shortest' | 'simple' | 'random';

export interface Sequence {
  id: string;
  origin: Origin;
  steps: SequenceStep[];
}

export interface TraceStep {
  input: SequenceStep | { start: true };
  value: unknown;
  context: unknown;
  status: 'active' | 'done' | 'error' | 'stopped';
  output?: unknown;
  error?: string;
  processed: NormalizedEvent[];
  children: Array<{ id: string; src: string }>;
  sent: Array<{ to: string; event: NormalizedEvent; delay?: number }>;
  emitted: NormalizedEvent[];
  actions: Array<{ type: string; params: unknown }>;
}

export interface Trace {
  sequenceId: string;
  steps: TraceStep[];
}

export type StubSpec = 'pending' | { done: unknown } | { error: string };

export interface Stubs {
  actors?: Record<string, StubSpec>;
  delays?: Record<string, number>;
}

/** `{ TYPE: [payload, …] }`; each payload is merged into `{ type: TYPE }`. */
export type EventCases = Record<string, Array<Record<string, unknown>>>;

export interface GenerateOptions {
  seed: number;
  walks: number;
  steps: number;
  maxSequences: number;
}

export interface Baseline {
  version: 1;
  file: string;
  export: string;
  xstateVersion: string;
  options: GenerateOptions;
  events: EventCases;
  stubs: Stubs;
  sequences: Sequence[];
  traces: Trace[];
  unstubbed: string[];
  eventsWithoutCases: string[];
  /** Graph origins or events dropped because a guard threw while generating. */
  generationErrors: string[];
  nonSerializable: number;
}

export interface ChildJob {
  mode: 'baseline' | 'replay';
  file: string;
  export?: string;
  events: EventCases;
  stubs: Stubs;
  options: GenerateOptions;
  /** Replay only. */
  sequences?: Sequence[];
}

export type ChildResult =
  | {
      ok: true;
      export: string;
      xstateVersion: string;
      sequences: Sequence[];
      traces: Trace[];
      unstubbed: string[];
      eventsWithoutCases: string[];
      generationErrors?: string[];
      nonSerializable: number;
    }
  | { ok: false; code: string; message: string; stack?: string };

export type Classification =
  | 'unclassified'
  | { rule: string; section: string; note: string };

export interface Diff {
  sequenceId: string;
  origin: Origin;
  step: number;
  witness: SequenceStep[];
  field: string;
  expected: unknown;
  actual: unknown;
  classification: Classification;
}

export interface VerifyReport {
  status: 'equivalent' | 'diverged' | 'error';
  v5: { file: string; export: string; xstateVersion: string };
  v6: { file: string; export: string; xstateVersion: string };
  sequences: number;
  stepsCompared: number;
  diffs: Diff[];
  intentional: number;
  unstubbed: string[];
  eventsWithoutCases: string[];
  generationErrors: string[];
  nonSerializable: number;
  notes: string[];
  error?: {
    phase: 'baseline' | 'replay';
    code: string;
    message: string;
    stack?: string;
    stderr: string;
  };
}

/** Per-step buckets a recorder fills from inspection events. */
export interface StepRecord {
  processed: NormalizedEvent[];
  sent: TraceStep['sent'];
  emitted: NormalizedEvent[];
  actions: TraceStep['actions'];
}

export interface Recorder {
  setRoot(root: unknown): void;
  inspect(event: any): void;
  emit(event: any): void;
  srcOf(ref: unknown): string;
  take(): StepRecord;
}

export interface Stats {
  nonSerializable: number;
}
