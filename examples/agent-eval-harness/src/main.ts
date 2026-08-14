import { setup, types } from 'xstate';

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

/**
 * `@xstate/graph` has no v6-compatible release in this repo, so path
 * generation is hand-rolled here: a breadth-first walk over
 * `machine.transition`, using `snapshot.nodes` to discover which events the
 * current state actually handles.
 */
type AnyMachine = typeof agentMachine;
type Snapshot = ReturnType<AnyMachine['getInitialSnapshot']>;
type Event = Parameters<AnyMachine['transition']>[1];

/** Sample payloads per event type — one entry per equivalence class. */
const eventSamples: Event[] = [
  { type: 'ask', question: 'how do statecharts work' },
  { type: 'ask', question: 'why' },
  { type: 'clarify' },
  { type: 'retrieved' },
  { type: 'answer' },
  { type: 'abort' }
];

interface Step {
  event: Event;
  snapshot: Snapshot;
}

const key = (snapshot: Snapshot) =>
  `${JSON.stringify(snapshot.value)}|${JSON.stringify(snapshot.context)}`;

/** Events handled by the currently active state nodes, ancestors included. */
const enabledEvents = (snapshot: Snapshot): Event[] => {
  const handled = new Set(
    snapshot.nodes.flatMap((node) => node.ownEvents as string[])
  );
  return eventSamples.filter((event) => handled.has(event.type));
};

/** Breadth-first enumeration of every simple path to a final state. */
function getSimplePaths(machine: AnyMachine): Step[][] {
  const initial = machine.getInitialSnapshot();
  const paths: Step[][] = [];
  const queue: Array<{ snapshot: Snapshot; path: Step[]; seen: Set<string> }> =
    [{ snapshot: initial, path: [], seen: new Set([key(initial)]) }];

  while (queue.length) {
    const { snapshot, path, seen } = queue.shift()!;

    if (snapshot.status === 'done') {
      paths.push(path);
      continue;
    }

    for (const event of enabledEvents(snapshot)) {
      const [next] = machine.transition(snapshot, event);
      const nextKey = key(next);
      // A simple path never revisits a state, so loops terminate.
      if (seen.has(nextKey)) {
        continue;
      }
      queue.push({
        snapshot: next,
        path: [...path, { event, snapshot: next }],
        seen: new Set([...seen, nextKey])
      });
    }
  }

  return paths;
}

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

const paths = getSimplePaths(agentMachine);
log(`enumerated ${paths.length} simple path(s) to a final state\n`);

let failures = 0;
const visited = new Set<string>([
  String(agentMachine.getInitialSnapshot().value)
]);

for (const [index, path] of paths.entries()) {
  const trace = path
    .map(
      (step) => `${step.event.type} → ${JSON.stringify(step.snapshot.value)}`
    )
    .join(' | ');
  log(`path ${index + 1}: ${trace}`);

  for (const step of path) {
    visited.add(String(step.snapshot.value));
    for (const invariant of invariants) {
      if (!invariant.holds(step.snapshot)) {
        failures++;
        log(`  ✗ ${invariant.name} (after ${step.event.type})`);
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
