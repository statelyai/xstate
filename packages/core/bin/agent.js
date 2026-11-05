// Data-only agent operations. No application module loading, code evaluation or effect
// execution is needed to inspect and explore a JSON machine definition.
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { createHash } = require('node:crypto');
const core = require('../dist/xstate.cjs.js');
const graph = require('../dist/xstate-graph.cjs.js');
const { version } = require('../package.json');

function fail(code, message, details) {
  const error = new Error(message);
  error.code = code;
  error.details = details;
  throw error;
}

function readJSON(file) {
  if (!file) fail('MISSING_ARGUMENT', 'Expected a JSON file path.');
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    fail('INVALID_JSON', `Cannot read JSON from ${file}: ${error.message}`);
  }
}

function expressions(value, path = '') {
  if (!value || typeof value !== 'object') return [];
  if (Object.hasOwn(value, '@code')) return [path];
  return Object.entries(value).flatMap(([key, entry]) =>
    expressions(
      entry,
      `${path}/${key.replaceAll('~', '~0').replaceAll('/', '~1')}`
    )
  );
}

function loadMachine(file) {
  const definition = readJSON(file);
  if (
    !definition ||
    typeof definition !== 'object' ||
    Array.isArray(definition)
  ) {
    fail('INVALID_MACHINE', 'Expected a machine definition object.');
  }
  const paths = expressions(definition);
  if (paths.length) {
    fail(
      'EVALUATOR_REQUIRED',
      'The data-only CLI does not evaluate code expressions. Use the library with explicit runtime sources.',
      { paths }
    );
  }
  try {
    return {
      definition,
      machine: core.machineFromJSON(definition),
      hash: createHash('sha256')
        .update(JSON.stringify(definition))
        .digest('hex')
    };
  } catch (error) {
    fail('INVALID_MACHINE', error.message);
  }
}

function view(snapshot) {
  return {
    value: snapshot.value,
    context: snapshot.context,
    stateInputs: snapshot.getInputs(),
    status: snapshot.status,
    output: snapshot.output,
    error:
      snapshot.error instanceof Error
        ? { name: snapshot.error.name, message: snapshot.error.message }
        : snapshot.error
  };
}

function effectView(effect) {
  return {
    type: effect.type,
    kind: effect.kind,
    params: effect.params,
    event: effect.event
  };
}

function eventList(value) {
  const events = Array.isArray(value) ? value : value?.events;
  if (
    !Array.isArray(events) ||
    events.some((event) => !event || typeof event.type !== 'string')
  ) {
    fail(
      'INVALID_EVENTS',
      'Expected an array of event objects with string type fields.'
    );
  }
  return events;
}

function replay(machine, events, input) {
  let [snapshot, effects] = core.initialTransition(machine, input);
  const trace = [
    { event: null, snapshot: view(snapshot), effects: effects.map(effectView) }
  ];
  const snapshots = [snapshot];
  for (const event of events) {
    [snapshot, effects] = core.transition(machine, snapshot, event);
    snapshots.push(snapshot);
    trace.push({
      event,
      snapshot: view(snapshot),
      effects: effects.map(effectView)
    });
  }
  return { trace, snapshots };
}

function assertions(machine, options) {
  const states = new Set([
    machine.root.id,
    ...graph.getDescendantStateNodes(machine.root).map((node) => node.id)
  ]);
  for (const kind of ['never', 'reachable']) {
    if (options[kind] === undefined) continue;
    if (
      !Array.isArray(options[kind]) ||
      options[kind].some(
        (id) =>
          typeof id !== 'string' ||
          !id.startsWith('#') ||
          !states.has(id.slice(1))
      )
    ) {
      fail(
        'INVALID_ASSERTION',
        `${kind} must list existing state IDs prefixed with #.`
      );
    }
  }
}

function violation(snapshots, never = []) {
  for (const snapshot of snapshots) {
    for (const state of never) {
      if (snapshot.matches(state)) return { state, snapshot: view(snapshot) };
    }
  }
}

function difference(before, after, path = '') {
  if (JSON.stringify(before) === JSON.stringify(after)) return [];
  if (
    before &&
    after &&
    typeof before === 'object' &&
    typeof after === 'object' &&
    !Array.isArray(before) &&
    !Array.isArray(after)
  ) {
    return [...new Set([...Object.keys(before), ...Object.keys(after)])]
      .sort()
      .flatMap((key) => {
        const pointer = `${path}/${key.replaceAll('~', '~0').replaceAll('/', '~1')}`;
        if (!Object.hasOwn(before, key))
          return [{ op: 'add', path: pointer, after: after[key] }];
        if (!Object.hasOwn(after, key))
          return [{ op: 'remove', path: pointer, before: before[key] }];
        return difference(before[key], after[key], pointer);
      });
  }
  return [{ op: 'replace', path, before, after }];
}

function run(command, rawArgs) {
  const args = rawArgs.filter((arg) => arg !== '--json');
  if (command === 'docs') {
    return {
      index: join(__dirname, '../docs/index.md'),
      agentGuide: join(__dirname, '../docs/agents.md'),
      stability: readJSON(join(__dirname, '../docs/api-stability.json'))
    };
  }
  if (command === 'diff') {
    const changes = difference(readJSON(args[0]), readJSON(args[1]));
    return {
      changed: changes.length > 0,
      changes,
      compatibility: 'notChecked'
    };
  }
  const { machine, definition, hash } = loadMachine(args[0]);
  if (command === 'validate')
    return {
      valid: true,
      scope: 'definition',
      runtimePayloadValidation: false
    };
  if (command === 'inspect') {
    return {
      definition,
      graph: graph.toDirectedGraph(machine),
      serializationDiagnostics:
        core.getMachineSerializationDiagnostics(machine),
      runtimePayloadValidation: false
    };
  }
  if (command === 'simulate') {
    const request = readJSON(args[1]);
    return {
      effectsExecuted: false,
      ...omitSnapshots(replay(machine, eventList(request), request.input))
    };
  }
  if (command === 'replay') {
    const fixture = readJSON(args[1]);
    if (
      fixture.schemaVersion !== 1 ||
      fixture.machineHash !== hash ||
      fixture.xstateVersion !== version
    ) {
      fail(
        'FIXTURE_MISMATCH',
        'The fixture must match this definition, XState version and fixture format.'
      );
    }
    assertions(machine, fixture);
    const result = replay(machine, eventList(fixture), fixture.input);
    const failure = violation(result.snapshots, fixture.never);
    if (failure)
      fail('PROPERTY_VIOLATION', 'A forbidden stable state was reached.', {
        ...failure,
        trace: result.trace,
        fixture
      });
    return { effectsExecuted: false, trace: result.trace };
  }
  if (command === 'test') {
    const options = readJSON(args[1]);
    assertions(machine, options);
    if (!(options.never?.length || options.reachable?.length)) {
      fail(
        'MISSING_ASSERTION',
        'Supply at least one never or reachable state assertion.'
      );
    }
    if (
      options.limit !== undefined &&
      (!Number.isSafeInteger(options.limit) || options.limit <= 0)
    ) {
      fail('INVALID_LIMIT', 'limit must be a positive safe integer.');
    }
    const paths = graph.getShortestPaths(machine, {
      events: options.events,
      input: options.input,
      limit: options.limit ?? 10000
    });
    const visited = paths.map((path) => path.state);
    const errored = visited.find((snapshot) => snapshot.status === 'error');
    if (errored)
      fail(
        'MODEL_EXECUTION_FAILED',
        'Model exploration entered an error snapshot.',
        { snapshot: view(errored) }
      );
    for (const path of paths) {
      const failure = violation(
        path.steps.map((step) => step.state),
        options.never
      );
      if (failure) {
        const fixture = {
          schemaVersion: 1,
          xstateVersion: version,
          machineHash: hash,
          events: path.steps.slice(1).map((step) => step.event),
          input: options.input,
          never: options.never
        };
        fail('PROPERTY_VIOLATION', 'A forbidden stable state was reached.', {
          ...failure,
          fixture
        });
      }
    }
    const missing = (options.reachable ?? []).filter(
      (state) => !visited.some((snapshot) => snapshot.matches(state))
    );
    if (missing.length)
      fail(
        'REACHABILITY_NOT_WITNESSED',
        'No supplied event representative reached these states.',
        { states: missing }
      );
    return {
      passed: true,
      scope: 'stableSnapshots',
      effectsExecuted: false,
      proof: false,
      representativeEvents: options.events ?? null,
      eventMode: Array.isArray(options.events)
        ? 'replaceDefaults'
        : 'augmentDefaults',
      limit: options.limit ?? 10000,
      paths: paths.length,
      states: visited.map(view)
    };
  }
  fail('UNKNOWN_COMMAND', `Unknown agent command: ${command}`);
}

function omitSnapshots({ trace }) {
  return { trace };
}

module.exports = (command, args) => {
  try {
    const result = run(command, args);
    console.log(
      JSON.stringify({
        schemaVersion: 1,
        xstateVersion: version,
        command,
        ok: true,
        result
      })
    );
  } catch (error) {
    console.log(
      JSON.stringify({
        schemaVersion: 1,
        xstateVersion: version,
        command,
        ok: false,
        error: {
          code: error.code ?? 'OPERATION_FAILED',
          message: error.message,
          details: error.details
        }
      })
    );
    process.exitCode = 1;
  }
};
