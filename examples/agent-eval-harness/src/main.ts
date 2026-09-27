import { setup, types } from 'xstate';
import { getSimplePaths } from 'xstate/graph';

const log = (message: string) => console.log(message);

/**
 * A tiny agent: it must retrieve before it may answer, it may ask one
 * clarifying question, and every run ends in `done`.
 */
const agentMachine = setup({
  schemas: {
    context: types<{ retrieved: boolean; answered: boolean }>(),
    events: {
      ask: types<{ question: string }>(),
      clarify: types<{}>(),
      retrieved: types<{}>(),
      answer: types<{}>(),
      abort: types<{}>()
    }
  }
}).createMachine({
  context: { retrieved: false, answered: false },
  initial: 'idle',
  states: {
    idle: {
      on: {
        ask: ({ event }) =>
          event.question.length < 5
            ? { target: 'clarifying' }
            : { target: 'retrieving' }
      }
    },
    clarifying: {
      on: {
        clarify: { target: 'retrieving' },
        abort: { target: 'done' }
      }
    },
    retrieving: {
      on: {
        retrieved: { target: 'answering', context: { retrieved: true } },
        abort: { target: 'done' }
      }
    },
    answering: {
      on: {
        answer: { target: 'done', context: { answered: true } }
      }
    },
    done: { type: 'final' }
  }
});

type Snapshot = ReturnType<(typeof agentMachine)['getInitialSnapshot']>;

/**
 * `getSimplePaths` from `xstate/graph` enumerates non-looping paths. The
 * `events` option supplies one sample payload per equivalence class: `ask` has
 * two, because the question length picks the branch. `toState` keeps only the
 * paths that end in a final state, which is where a full agent run ends.
 */
const paths = getSimplePaths(agentMachine, {
  events: [
    { type: 'ask', question: 'how do statecharts work' },
    { type: 'ask', question: 'why' },
    { type: 'clarify' },
    { type: 'retrieved' },
    { type: 'answer' },
    { type: 'abort' }
  ],
  toState: (snapshot) => snapshot.status === 'done'
});

/** Invariants asserted at every step of every path. */
const invariants: Array<{
  name: string;
  holds: (snapshot: Snapshot) => boolean;
}> = [
  {
    name: 'never answers without retrieving',
    holds: (snapshot) =>
      !snapshot.context.answered || snapshot.context.retrieved
  },
  {
    name: 'never sits in answering without retrieval',
    holds: (snapshot) =>
      snapshot.value !== 'answering' || snapshot.context.retrieved
  }
];

log(`enumerated ${paths.length} simple path(s) to a final state\n`);

let failures = 0;
const visited = new Set<string>();

for (const [index, path] of paths.entries()) {
  const events = path.steps.map((step) => step.event.type).join(' → ');
  log(
    `path ${index + 1}: reaches ${JSON.stringify(path.state.value)}: ${events}`
  );

  // Each step holds the snapshot *after* its event; the first step is the
  // initial snapshot, reached by `@xstate.init`.
  for (const { state: snapshot } of path.steps) {
    visited.add(String(snapshot.value));
    for (const invariant of invariants) {
      if (!invariant.holds(snapshot)) {
        failures++;
        log(`  ✗ ${invariant.name} at ${JSON.stringify(snapshot.value)}`);
      }
    }
  }
}

// Coverage: every state should be reachable by some path.
const allStates = Object.keys(agentMachine.states);
const unreached = allStates.filter((state) => !visited.has(state));

log('');
log(`invariant violations: ${failures}`);
log(`states covered: ${visited.size}/${allStates.length}`);
log(
  unreached.length
    ? `unreachable: ${unreached.join(', ')}`
    : 'all states reachable'
);

if (failures > 0 || unreached.length > 0) {
  process.exitCode = 1;
}
