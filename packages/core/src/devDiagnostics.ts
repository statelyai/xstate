import isDevelopment from '#is-development';

/**
 * Checks for leftover v5 configuration on hand-written machine configs, setup
 * configs and actor options. Keys that v6 would silently ignore throw in every
 * build; harmless leftovers only warn in development.
 */

const INLINE_TRANSITION =
  'Use an inline transition function instead: return { target } when the condition passes, or undefined to reject the event (before any enq call, which would select the transition). Named guards are available as `guards.name(...)` in its arguments.';

const INLINE_ACTION =
  'Use a single inline function `(args, enq) => { ... }`; call named actions with `enq(actions.name, params)`.';

const REMOVED_ROOT_KEYS: Record<string, string> = {
  types:
    '"types" was replaced by "schemas". Declare contracts under `schemas` (or `setup({ schemas })`), or use `types<T>()` inside `schemas` for type-only contracts.',
  tsTypes:
    '"tsTypes" (typegen) was removed. Declare contracts under `schemas` (or `setup({ schemas })`).',
  schema:
    '"schema" was replaced by "schemas". Declare contracts under `schemas` (or `setup({ schemas })`).',
  internalEvents:
    'The top-level "internalEvents" list was removed. Declare private events under `schemas.internalEvents` instead, e.g. `schemas: { internalEvents: { tick: types<{}>() } }`.'
};

const UNSUPPORTED_SETUP_KEYS: Record<string, string> = {
  internalEvents:
    'setup() has no "internalEvents" option. Declare private events under `schemas.internalEvents` instead, e.g. `setup({ schemas: { internalEvents: { tick: types<{}>() } } })`.'
};

const IGNORED_ROOT_KEYS: Record<string, string> = {
  services:
    '"services" was renamed. Provide actor logic under "actors" (or `setup({ actors })`).',
  devTools:
    '"devTools" was removed. Pass the "inspect" option to `createActor(...)` instead.'
};

const ACTIVITIES =
  'uses "activities", which was removed. Invoke an actor with "invoke" instead.';

// Leftovers that change nothing in v6; reported in development only.
const HARMLESS_ROOT_KEYS: Record<string, string> = {
  predictableActionArguments:
    'was removed with no replacement; v6 always runs effects in order.',
  preserveActionOrder:
    'was removed with no replacement; v6 always runs effects in order.',
  strict: 'was removed with no replacement.'
};

const TRANSITION_KEYS = ['onDone', 'onError', 'onTimeout', 'always'] as const;
const INVOKE_TRANSITION_KEYS = [
  'onDone',
  'onError',
  'onSnapshot',
  'onTimeout'
] as const;

function checkTransitions(
  transitions: unknown,
  name: string,
  stateId: string
): void {
  if (!transitions) return;
  for (const t of Array.isArray(transitions) ? transitions : [transitions]) {
    if (!t || typeof t !== 'object') continue;
    const where = `Transition "${name}" in ${describeState(stateId)}`;
    if ((t as any).cond !== undefined) {
      throw new Error(
        `${where} uses "cond", which was removed. ${INLINE_TRANSITION}`
      );
    }
    if ((t as any).guard !== undefined) {
      throw new Error(
        `${where} uses an object-form "guard", which was removed. ${INLINE_TRANSITION}`
      );
    }
    if ((t as any).actions !== undefined) {
      throw new Error(
        `${where} uses "actions", which was removed. Use an inline transition function \`(args, enq) => { ... }\` and queue effects on "enq"; call named actions with \`enq(actions.name, params)\`.`
      );
    }
  }
}

// The root of a machine without an id has the empty id.
function describeState(stateId: string): string {
  return stateId ? `state "${stateId}"` : 'the root state';
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function checkInitialTransition(initial: any, stateId: string): void {
  if (!initial || typeof initial !== 'object') return;
  const where = `Initial transition of ${describeState(stateId)}`;
  const unguarded =
    'Initial transitions cannot be guarded; use an "always" transition on the target state to redirect conditionally.';
  if (initial.cond !== undefined) {
    throw new Error(`${where} uses "cond", which was removed. ${unguarded}`);
  }
  if (initial.guard !== undefined) {
    throw new Error(
      `${where} uses an object-form "guard", which was removed. ${unguarded}`
    );
  }
  if (initial.actions !== undefined) {
    throw new Error(
      `${where} uses "actions", which was removed. Use a \`to: (args, enq) => { ... }\` function on the initial transition and queue effects on "enq", or an "entry" function on the target state.`
    );
  }
}

function checkStateNode(node: any, stateId: string): void {
  checkInitialTransition(node.initial, stateId);
  if (node.activities !== undefined) {
    throw new Error(`${capitalize(describeState(stateId))} ${ACTIVITIES}`);
  }
  for (const key of ['entry', 'exit'] as const) {
    const action = node[key];
    if (action !== undefined && typeof action !== 'function') {
      const shape = Array.isArray(action)
        ? 'an array'
        : typeof action === 'string'
          ? `a string ("${action}")`
          : `a ${typeof action}`;
      throw new Error(
        `${capitalize(describeState(stateId))} has ${shape} as "${key}", which is not supported. ${INLINE_ACTION}`
      );
    }
  }
  if (node.on) {
    for (const eventType of Object.keys(node.on)) {
      checkTransitions(node.on[eventType], eventType, stateId);
    }
  }
  if (node.after) {
    for (const delay of Object.keys(node.after)) {
      checkTransitions(node.after[delay], `after.${delay}`, stateId);
    }
  }
  for (const key of TRANSITION_KEYS) {
    checkTransitions(node[key], key, stateId);
  }
  if (node.invoke) {
    for (const invoke of Array.isArray(node.invoke)
      ? node.invoke
      : [node.invoke]) {
      if (!invoke || typeof invoke !== 'object') continue;
      for (const key of INVOKE_TRANSITION_KEYS) {
        checkTransitions(invoke[key], `invoke.${key}`, stateId);
      }
    }
  }
  if (node.states) {
    for (const key of Object.keys(node.states)) {
      const child = node.states[key];
      if (child && typeof child === 'object') {
        checkStateNode(
          child,
          child.id ?? (stateId ? `${stateId}.${key}` : key)
        );
      }
    }
  }
}

/**
 * Throws (or warns, for harmless leftovers) when a hand-written machine config
 * contains v5 keys that v6 would otherwise ignore or misread.
 */
export function diagnoseAuthorConfig(config: any): void {
  if (!config || typeof config !== 'object') return;
  for (const key of Object.keys(REMOVED_ROOT_KEYS)) {
    if (config[key] !== undefined) {
      throw new Error(REMOVED_ROOT_KEYS[key]);
    }
  }
  for (const key of Object.keys(IGNORED_ROOT_KEYS)) {
    if (config[key] !== undefined) {
      throw new Error(IGNORED_ROOT_KEYS[key]);
    }
  }
  if (isDevelopment) {
    for (const key of Object.keys(HARMLESS_ROOT_KEYS)) {
      if (config[key] !== undefined) {
        console.warn(`Machine config "${key}" ${HARMLESS_ROOT_KEYS[key]}`);
      }
    }
  }
  checkStateNode(config, config.id ?? '');
}

/**
 * Throws when a `setup(...)` config contains a key that belongs elsewhere and
 * would otherwise be ignored.
 */
export function diagnoseSetupConfig(config: any): void {
  if (!config || typeof config !== 'object') return;
  for (const key of Object.keys(UNSUPPORTED_SETUP_KEYS)) {
    if (config[key] !== undefined) {
      throw new Error(UNSUPPORTED_SETUP_KEYS[key]);
    }
  }
}

const REMOVED_ACTOR_OPTIONS: Record<string, string> = {
  parent:
    'The "parent" actor option was removed. Create child actors through invoke, spawn, or enq.spawn instead.',
  systemId:
    'The "systemId" actor option was renamed. Use "registryKey": createActor(logic, { registryKey }), and look the actor up with system.get(registryKey).',
  state:
    'The "state" actor option was removed. Pass the persisted snapshot as "snapshot" instead: createActor(logic, { snapshot }).',
  devTools:
    'The "devTools" actor option was removed. Pass the "inspect" option instead: createActor(logic, { inspect }).',
  deferEvents:
    'The "deferEvents" actor option was removed. Events sent before start() are always queued until the actor starts.',
  execute:
    'The "execute" actor option was removed. Effects always run when the actor processes an event; use transition() for pure, effect-free steps.'
};

const ACTOR_OPTIONS = new Set([
  'clock',
  'logger',
  'syncSnapshot',
  'id',
  'registryKey',
  'input',
  'snapshot',
  'src',
  'inspect',
  'onRejectedEvent',
  'onUnhandledEvent',
  '_systemRef',
  '_sessionId',
  '_inert'
]);

/**
 * Throws when `createActor(...)` options contain a key that v6 does not read,
 * so a misspelled or v5-era option fails instead of being ignored.
 */
export function diagnoseActorOptions(options: any): void {
  if (!options || typeof options !== 'object') return;
  for (const key of Object.keys(options)) {
    if (ACTOR_OPTIONS.has(key)) continue;
    throw new Error(
      REMOVED_ACTOR_OPTIONS[key] ??
        `Unknown actor option "${key}". Supported options: ${[...ACTOR_OPTIONS]
          .filter((name) => !name.startsWith('_'))
          .join(', ')}.`
    );
  }
}
