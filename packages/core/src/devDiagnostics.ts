/**
 * Development-only checks for leftover v5 configuration on hand-written
 * machine configs. Only reachable behind `isDevelopment`, so production builds
 * drop this module.
 */

const INLINE_TRANSITION =
  'Use an inline transition function instead: return { target } when the condition passes, or undefined to reject the event. Named guards are available as `guards.name(...)` in its arguments.';

const INLINE_ACTION =
  'Use a single inline function `(args, enq) => { ... }`; call named actions with `enq(actions.name, params)`.';

const REMOVED_ROOT_KEYS: Record<string, string> = {
  types:
    '"types" was replaced by "schemas". Declare contracts under `schemas` (or `setup({ schemas })`), or use `types<T>()` inside `schemas` for type-only contracts.',
  tsTypes:
    '"tsTypes" (typegen) was removed. Declare contracts under `schemas` (or `setup({ schemas })`).',
  schema:
    '"schema" was replaced by "schemas". Declare contracts under `schemas` (or `setup({ schemas })`).'
};

const IGNORED_ROOT_KEYS: Record<string, string> = {
  services:
    'was renamed; provide actor logic under "actors" (or `setup({ actors })`).',
  activities: 'was removed; invoke an actor with "invoke" instead.',
  predictableActionArguments:
    'was removed with no replacement; v6 always runs effects in order.',
  preserveActionOrder:
    'was removed with no replacement; v6 always runs effects in order.',
  strict: 'was removed with no replacement.',
  devTools:
    'was removed; pass the "inspect" option to `createActor(...)` instead.'
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
    const where = `Transition "${name}" in state "${stateId}"`;
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

function checkStateNode(node: any, stateId: string): void {
  if (node.activities !== undefined) {
    console.warn(
      `State "${stateId}": "activities" ${IGNORED_ROOT_KEYS.activities}`
    );
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
        `State "${stateId}" has ${shape} as "${key}", which is not supported. ${INLINE_ACTION}`
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
        checkStateNode(child, child.id ?? `${stateId}.${key}`);
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
    if (key !== 'activities' && config[key] !== undefined) {
      console.warn(`Machine config "${key}" ${IGNORED_ROOT_KEYS[key]}`);
    }
  }
  checkStateNode(config, config.id ?? '(machine)');
}
