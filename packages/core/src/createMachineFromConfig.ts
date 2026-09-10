import {
  Action,
  AnyActorLogic,
  AnyEventObject,
  AnyStateMachine,
  EventObject,
  MachineContext,
  MetaObject
} from './types';
import { createMachine } from './createMachine';
import { parseDelayToMilliseconds } from './delay';

function delayToMs(delay: string | number): number {
  const parsedDelay = parseDelayToMilliseconds(delay);
  if (parsedDelay !== undefined) return parsedDelay;
  return typeof delay === 'string' ? parseFloat(delay) || 0 : delay;
}

interface RaiseJSON {
  type: '@xstate.raise';
  event: EventObject;
  id?: string;
  delay?: number;
}

interface CancelJSON {
  type: '@xstate.cancel';
  id: string;
}

interface LogJSON {
  type: '@xstate.log';
  args: any[];
}

interface EmitJSON {
  type: '@xstate.emit';
  event: AnyEventObject;
}

interface AssignJSON {
  type: '@xstate.assign';
  context: MachineContext;
}

type BuiltInActionJSON =
  | RaiseJSON
  | CancelJSON
  | LogJSON
  | EmitJSON
  | AssignJSON;

interface CustomActionJSON {
  type: string;
  params?: unknown;
}

export type ActionJSON =
  | CustomActionJSON
  | BuiltInActionJSON
  | ExpressionJSON
  | CodeJSON;

export interface GuardJSON {
  type: string;
  params?: unknown;
}

interface ExpressionJSON {
  '@expr': string;
  '@lang'?: string;
}

interface CodeJSON {
  '@code': string;
  '@lang'?: string;
}

type ResolvableJSON = ExpressionJSON | CodeJSON;
type ConditionJSON = GuardJSON | ResolvableJSON;

interface ChoiceBranchJSON {
  when?: ConditionJSON;
  target: string | string[];
  context?: MachineContext;
  input?: unknown;
  description?: string;
  reenter?: boolean;
  meta?: MetaObject;
}

export interface InvokeJSON {
  id?: string;
  registryKey?: string;
  src: string;
  input?: unknown;
  onDone?: TransitionConfigJSON | TransitionConfigJSON[];
  onError?: TransitionConfigJSON | TransitionConfigJSON[];
  onSnapshot?: TransitionConfigJSON | TransitionConfigJSON[];
  timeout?: number | string | ResolvableJSON;
  onTimeout?: TransitionConfigJSON | TransitionConfigJSON[];
}

export interface TransitionJSON {
  target?: string | string[];
  matches?: Record<string, unknown>;
  context?: MachineContext;
  actions?: ActionJSON[];
  guard?: ConditionJSON;
  description?: string;
  reenter?: boolean;
  meta?: MetaObject;
  input?: unknown;
}

type TransitionConfigJSON = TransitionJSON | ResolvableJSON;

export interface StateNodeJSON {
  id?: string;
  key?: string;
  type?: 'atomic' | 'compound' | 'parallel' | 'final' | 'history' | 'choice';
  initial?: string;
  states?: Record<string, StateNodeJSON>;
  on?: Record<string, TransitionConfigJSON | TransitionConfigJSON[]>;
  onError?: TransitionConfigJSON | TransitionConfigJSON[];
  after?: Record<string, TransitionConfigJSON | TransitionConfigJSON[]>;
  always?: TransitionConfigJSON | TransitionConfigJSON[];
  choice?: ChoiceBranchJSON[] | ResolvableJSON;
  route?:
    | {
        description?: string;
        reenter?: boolean;
        meta?: MetaObject;
        guard?: string;
        input?: Record<string, unknown>;
      }
    | ResolvableJSON;
  invoke?: InvokeJSON | InvokeJSON[];
  entry?: ActionJSON | ActionJSON[];
  exit?: ActionJSON | ActionJSON[];
  meta?: MetaObject;
  description?: string;
  tags?: string[];
  input?: unknown;
  timeout?: number | string | ResolvableJSON;
  onTimeout?: TransitionConfigJSON | TransitionConfigJSON[];
  history?: 'shallow' | 'deep';
  target?: string | [string, ...string[]];
  output?: unknown;
  context?: Record<string, unknown>;
}

export interface MachineJSON extends StateNodeJSON {
  '@exprLang'?: string;
  version?: string;
  actions?: Record<string, ActionJSON | ActionJSON[]>;
  guards?: Record<string, { when: ConditionJSON }>;
  actors?: Record<string, unknown>;
  delays?: Record<
    string,
    number | string | { duration: number | string | ResolvableJSON }
  >;
  schemas?: Record<string, unknown>;
}

type EvaluatorSlot =
  | 'context'
  | 'guard'
  | 'choice'
  | 'action'
  | 'actionParams'
  | 'transition'
  | 'input'
  | 'output'
  | 'delay'
  | 'transitionContext'
  | 'unknown';

type EvaluatorKind = 'expr' | 'code';

interface EvaluatorArgs {
  source: string;
  kind: EvaluatorKind;
  slot: EvaluatorSlot;
  scope: Record<string, unknown>;
  path: string;
}

interface MachineSources {
  actions?: Record<string, (...args: any[]) => unknown>;
  guards?: Record<string, (...args: any[]) => boolean>;
  actors?: Record<string, AnyActorLogic>;
  delays?: Record<string, number | ((...args: any[]) => number)>;
  evaluators?: Record<string, (args: EvaluatorArgs) => unknown>;
}

type ProvidedSources = Required<MachineSources>;

function isExpression(value: unknown): value is ExpressionJSON {
  return (
    !!value &&
    typeof value === 'object' &&
    typeof (value as any)['@expr'] === 'string'
  );
}

function isCode(value: unknown): value is CodeJSON {
  return (
    !!value &&
    typeof value === 'object' &&
    typeof (value as any)['@code'] === 'string'
  );
}

function isResolvable(value: unknown): value is ResolvableJSON {
  return isExpression(value) || isCode(value);
}

function isBuiltInActionType(type: string): boolean {
  return type.startsWith('@xstate.');
}

function toPath(parent: string, key: string | number): string {
  return typeof key === 'number' ? `${parent}[${key}]` : `${parent}.${key}`;
}

function extractSerializableDelays(
  delays: MachineJSON['delays'] | undefined
): Record<string, number> {
  const result: Record<string, number> = {};
  if (!delays) {
    return result;
  }
  for (const key of Object.keys(delays)) {
    const value = delays[key];
    if (typeof value === 'number') {
      result[key] = value;
    } else if (
      value &&
      typeof value === 'object' &&
      typeof value.duration === 'number'
    ) {
      result[key] = value.duration;
    }
  }
  return result;
}

function mergeSources(
  json: MachineJSON,
  sources: MachineSources
): ProvidedSources {
  return {
    actions: sources.actions ?? {},
    guards: sources.guards ?? {},
    actors: sources.actors ?? {},
    delays: {
      ...extractSerializableDelays(json.delays),
      ...(sources.delays ?? {})
    },
    evaluators: sources.evaluators ?? {}
  };
}

interface ExpressionResolver {
  evaluateResolvable: (
    value: ResolvableJSON,
    slot: EvaluatorSlot,
    scope: Record<string, unknown>,
    path: string
  ) => unknown;
  resolveValue: (
    value: unknown,
    slot: EvaluatorSlot,
    scope: Record<string, unknown>,
    path: string
  ) => unknown;
  makeScope: (
    x: any,
    extra?: Record<string, unknown>
  ) => Record<string, unknown>;
  getDurationConfig: (value: unknown, path: string) => unknown;
  assertResolvable: (value: unknown, path: string) => void;
}

function createExpressionResolver(
  expressionLanguage: string | undefined,
  sources: ProvidedSources
): ExpressionResolver {
  function getEvaluator(value: ResolvableJSON, path: string) {
    const lang = value['@lang'] ?? expressionLanguage;
    if (!lang) {
      throw new Error(`Missing @exprLang for expression at ${path}`);
    }
    const evaluator = sources.evaluators[lang];
    if (!evaluator) {
      throw new Error(`Missing evaluator for @lang '${lang}' at ${path}`);
    }
    return evaluator;
  }

  function evaluateResolvable(
    value: ResolvableJSON,
    slot: EvaluatorSlot,
    scope: Record<string, unknown>,
    path: string
  ) {
    const kind = isExpression(value) ? 'expr' : 'code';
    const source = isExpression(value) ? value['@expr'] : value['@code'];
    return getEvaluator(
      value,
      path
    )({
      source,
      kind,
      slot,
      scope,
      path
    });
  }

  function resolveValue(
    value: unknown,
    slot: EvaluatorSlot,
    scope: Record<string, unknown>,
    path: string
  ): unknown {
    if (isResolvable(value)) {
      return evaluateResolvable(value, slot, scope, path);
    }
    if (Array.isArray(value)) {
      return value.map((item, index) =>
        resolveValue(item, slot, scope, toPath(path, index))
      );
    }
    if (!value || typeof value !== 'object') {
      return value;
    }
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(value)) {
      result[key] = resolveValue(
        (value as Record<string, unknown>)[key],
        slot,
        scope,
        toPath(path, key)
      );
    }
    return result;
  }

  function makeScope(x: any, extra?: Record<string, unknown>) {
    return {
      context: x.context,
      event: x.event,
      input: x.input,
      self: x.self,
      children: x.children,
      params: x.params,
      ...extra
    };
  }

  function getDurationConfig(value: unknown, path: string) {
    if (!isResolvable(value)) {
      return value;
    }
    return (args: any) =>
      delayToMs(
        resolveValue(value, 'delay', makeScope(args), path) as string | number
      );
  }

  function assertResolvable(value: unknown, path: string) {
    if (isResolvable(value)) {
      getEvaluator(value, path);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item, index) =>
        assertResolvable(item, toPath(path, index))
      );
      return;
    }
    if (!value || typeof value !== 'object') {
      return;
    }
    for (const key of Object.keys(value)) {
      assertResolvable(
        (value as Record<string, unknown>)[key],
        toPath(path, key)
      );
    }
  }

  return {
    evaluateResolvable,
    resolveValue,
    makeScope,
    getDurationConfig,
    assertResolvable
  };
}

function toActionArray(
  actions: ActionJSON | ActionJSON[] | undefined
): ActionJSON[] {
  return actions === undefined
    ? []
    : Array.isArray(actions)
      ? actions
      : [actions];
}

function validateChoiceConfig(choice: StateNodeJSON['choice'], path: string) {
  if (!Array.isArray(choice)) {
    return;
  }
  choice.forEach((branch, index) => {
    if (branch.when === undefined && index !== choice.length - 1) {
      throw new Error(
        `Choice fallback branch at ${path}[${index}] must be last.`
      );
    }
  });
}

function assertMachineJSON(
  json: MachineJSON,
  resolvedSources: ProvidedSources,
  expressionResolver: ExpressionResolver
) {
  const { assertResolvable } = expressionResolver;

  function assertCondition(condition: ConditionJSON | undefined, path: string) {
    if (!condition) {
      return;
    }
    if (isResolvable(condition)) {
      assertResolvable(condition, path);
      return;
    }
    assertResolvable(condition.params, `${path}.params`);
    if (json.guards?.[condition.type]) {
      assertCondition(
        json.guards[condition.type].when,
        `$.guards.${condition.type}.when`
      );
      return;
    }
    if (
      !resolvedSources.guards[condition.type] &&
      !['xstate.stateIn', 'xstate.not'].includes(condition.type)
    ) {
      throw new Error(`Missing guard source "${condition.type}"`);
    }
  }

  function assertAction(
    action: ActionJSON,
    path: string,
    stack: string[] = []
  ) {
    if (isResolvable(action)) {
      assertResolvable(action, path);
      return;
    }
    if (!action || typeof action.type !== 'string') {
      throw new Error(`Invalid action at ${path}`);
    }
    assertResolvable((action as CustomActionJSON).params, `${path}.params`);
    if (isBuiltInActionType(action.type)) {
      assertResolvable(action, path);
      return;
    }
    const definition = json.actions?.[action.type];
    if (definition) {
      if (stack.includes(action.type)) {
        throw new Error(
          `Circular action reference: ${stack.concat(action.type).join(' -> ')}`
        );
      }
      const definitions = Array.isArray(definition) ? definition : [definition];
      definitions.forEach((item, index) =>
        assertAction(
          item,
          `${path}.actions.${action.type}${definitions.length > 1 ? `[${index}]` : ''}`,
          stack.concat(action.type)
        )
      );
      return;
    }
    if (!resolvedSources.actions[action.type]) {
      throw new Error(`Missing action source "${action.type}"`);
    }
  }

  function assertActions(
    actions: ActionJSON | ActionJSON[] | undefined,
    path: string
  ) {
    toActionArray(actions).forEach((action, index) =>
      assertAction(action, `${path}[${index}]`)
    );
  }

  function assertTransition(
    transition: TransitionConfigJSON | TransitionConfigJSON[] | undefined,
    path: string
  ) {
    const transitions = Array.isArray(transition)
      ? transition
      : transition
        ? [transition]
        : [];
    transitions.forEach((t, index) => {
      const transitionPath = Array.isArray(transition)
        ? `${path}[${index}]`
        : path;
      if (isResolvable(t)) {
        assertResolvable(t, transitionPath);
        return;
      }
      assertCondition(t.guard, `${transitionPath}.guard`);
      assertActions(t.actions, `${transitionPath}.actions`);
      assertResolvable(t.context, `${transitionPath}.context`);
      assertResolvable(t.input, `${transitionPath}.input`);
    });
  }

  function assertStateNode(node: StateNodeJSON, path: string) {
    if (
      (node.type === 'history' || node.history !== undefined) &&
      !(
        (typeof node.target === 'string' && node.target.trim().length > 0) ||
        (Array.isArray(node.target) &&
          node.target.length > 0 &&
          node.target.every((target) => target.trim().length > 0))
      )
    ) {
      throw new Error(
        `History state at ${path} must declare a non-empty target.`
      );
    }
    assertResolvable(node.context, `${path}.context`);
    assertResolvable(node.input, `${path}.input`);
    assertResolvable(node.output, `${path}.output`);
    assertResolvable(node.timeout, `${path}.timeout`);
    assertActions(node.entry, `${path}.entry`);
    assertActions(node.exit, `${path}.exit`);
    if (node.type === 'choice') {
      if (!node.choice) {
        throw new Error(`Choice state at ${path} must declare choice.`);
      }
      if (Array.isArray(node.choice)) {
        validateChoiceConfig(node.choice, `${path}.choice`);
        node.choice.forEach((branch, index) => {
          assertCondition(branch.when, `${path}.choice[${index}].when`);
          assertResolvable(branch.context, `${path}.choice[${index}].context`);
          assertResolvable(branch.input, `${path}.choice[${index}].input`);
        });
      } else {
        assertResolvable(node.choice, `${path}.choice`);
      }
    }
    if (isResolvable(node.route)) {
      assertResolvable(node.route, `${path}.route`);
    }
    if (node.invoke) {
      const invokes = Array.isArray(node.invoke) ? node.invoke : [node.invoke];
      invokes.forEach((invoke, index) => {
        const invokePath = `${path}.invoke${Array.isArray(node.invoke) ? `[${index}]` : ''}`;
        if (!resolvedSources.actors[invoke.src]) {
          throw new Error(`Missing actor source "${invoke.src}"`);
        }
        assertResolvable(invoke.input, `${invokePath}.input`);
        assertResolvable(invoke.timeout, `${invokePath}.timeout`);
        assertTransition(invoke.onDone, `${invokePath}.onDone`);
        assertTransition(invoke.onError, `${invokePath}.onError`);
        assertTransition(invoke.onSnapshot, `${invokePath}.onSnapshot`);
        assertTransition(invoke.onTimeout, `${invokePath}.onTimeout`);
      });
    }
    if (node.on) {
      for (const descriptor of Object.keys(node.on)) {
        assertTransition(node.on[descriptor], `${path}.on.${descriptor}`);
      }
    }
    if (node.after) {
      for (const delay of Object.keys(node.after)) {
        if (
          Number.isNaN(Number(delay)) &&
          parseDelayToMilliseconds(delay) === undefined &&
          !json.delays?.[delay] &&
          !resolvedSources.delays[delay]
        ) {
          throw new Error(`Missing delay source "${delay}"`);
        }
        assertTransition(node.after[delay], `${path}.after.${delay}`);
      }
    }
    assertTransition(node.always, `${path}.always`);
    assertTransition(node.onError, `${path}.onError`);
    assertTransition(node.onTimeout, `${path}.onTimeout`);
    if (node.states) {
      for (const key of Object.keys(node.states)) {
        assertStateNode(node.states[key], `${path}.states.${key}`);
      }
    }
  }

  if (json.actions) {
    for (const key of Object.keys(json.actions)) {
      const actions = Array.isArray(json.actions[key])
        ? json.actions[key]
        : [json.actions[key]];
      actions.forEach((action, index) =>
        assertAction(
          action,
          `$.actions.${key}${actions.length > 1 ? `[${index}]` : ''}`,
          [key]
        )
      );
    }
  }
  if (json.guards) {
    for (const key of Object.keys(json.guards)) {
      assertCondition(json.guards[key].when, `$.guards.${key}.when`);
    }
  }
  if (json.delays) {
    for (const key of Object.keys(json.delays)) {
      const delay = json.delays[key];
      assertResolvable(
        delay && typeof delay === 'object' && 'duration' in delay
          ? delay.duration
          : delay,
        `$.delays.${key}`
      );
    }
  }
  assertStateNode(json, '$');
}

export function createMachineFromConfig(
  json: MachineJSON,
  sources: MachineSources = {}
): AnyStateMachine {
  const resolvedSources = mergeSources(json, sources);
  const expressionResolver = createExpressionResolver(
    json['@exprLang'],
    resolvedSources
  );
  const { evaluateResolvable, resolveValue, makeScope, getDurationConfig } =
    expressionResolver;

  type ResolvedCondition = ((args: any) => boolean) | undefined;

  function resolveCondition(
    condition: ConditionJSON | undefined,
    slot: 'guard' | 'choice',
    path: string
  ): ResolvedCondition {
    if (!condition) return undefined;
    if (isResolvable(condition)) {
      return (args: any) =>
        !!evaluateResolvable(condition, slot, makeScope(args), path);
    }
    return (args: any) => {
      const params = resolveValue(
        condition.params,
        slot,
        makeScope(args),
        `${path}.params`
      );
      const declarativeGuard = json.guards?.[condition.type];
      if (declarativeGuard) {
        const guard = resolveCondition(
          declarativeGuard.when,
          'guard',
          `$.guards.${condition.type}.when`
        );
        return !!guard?.({ ...args, params });
      }
      const guardImpl = args.guards?.[condition.type];
      if (!guardImpl) {
        throw new Error(
          getMissingGuardMessage(condition.type, args.guards ?? {})
        );
      }
      return guardImpl(args, params);
    };
  }

  function getMissingGuardMessage(type: string, guards: Record<string, any>) {
    return `Guard '${type}' is not implemented in machine '${json.id ?? '(machine)'}'. Available guards: ${
      Object.keys(guards)
        .map((key) => `'${key}'`)
        .join(', ') || '(none)'
    }.`;
  }

  function makeChoiceConfig(choice: StateNodeJSON['choice'], path: string) {
    if (!choice) return undefined;
    if (isResolvable(choice)) {
      return (args: any) =>
        evaluateResolvable(choice, 'choice', makeScope(args), path);
    }
    validateChoiceConfig(choice, path);
    return (args: any) => {
      for (let index = 0; index < choice.length; index++) {
        const branch = choice[index];
        const guard = resolveCondition(
          branch.when,
          'choice',
          `${path}[${index}].when`
        );
        if (!guard || guard(args)) {
          return {
            target: branch.target,
            context: branch.context
              ? resolveValue(
                  branch.context,
                  'transitionContext',
                  makeScope(args),
                  `${path}[${index}].context`
                )
              : undefined,
            input:
              branch.input !== undefined
                ? resolveValue(
                    branch.input,
                    'input',
                    makeScope(args),
                    `${path}[${index}].input`
                  )
                : undefined,
            description: branch.description,
            reenter: branch.reenter,
            meta: branch.meta
          };
        }
      }
      throw new Error(`Choice state at ${path} did not match any branch.`);
    };
  }

  function resolveRouteConfig(route: StateNodeJSON['route'], path: string) {
    if (!route || typeof route === 'function') return route;
    if (isResolvable(route)) {
      return (args: any) =>
        evaluateResolvable(route, 'transition', makeScope(args), path);
    }
    const { guard, ...routeConfig } = route;
    if (!guard) return routeConfig;
    const resolvedGuard = resolveCondition({ type: guard }, 'guard', path);
    return (args: any) => (resolvedGuard!(args) ? routeConfig : undefined);
  }

  function executeActions(
    actions: ActionJSON[],
    x: any,
    enq: any,
    stack: string[] = []
  ) {
    let context: MachineContext | undefined;
    for (const action of actions) {
      if (isResolvable(action)) {
        const result = evaluateResolvable(
          action,
          'action',
          makeScope(x, { params: x.params, enq }),
          '$.actions'
        );
        if (
          result &&
          typeof result === 'object' &&
          'context' in result &&
          (result as any).context
        ) {
          context ??= {};
          Object.assign(context, (result as any).context);
        }
        continue;
      }
      if (isBuiltInActionJSON(action)) {
        switch (action.type) {
          case '@xstate.raise':
            enq.raise(
              resolveValue(
                action.event,
                'actionParams',
                makeScope(x, { params: x.params }),
                '$.actions.event'
              ),
              { id: action.id, delay: action.delay }
            );
            break;
          case '@xstate.cancel':
            enq.cancel(action.id);
            break;
          case '@xstate.log':
            enq.log(...action.args);
            break;
          case '@xstate.emit':
            enq.emit(
              resolveValue(
                action.event,
                'actionParams',
                makeScope(x, { params: x.params }),
                '$.actions.event'
              )
            );
            break;
          case '@xstate.assign':
            context ??= {};
            Object.assign(
              context,
              resolveValue(
                action.context,
                'transitionContext',
                makeScope(x, { params: x.params }),
                '$.actions.context'
              )
            );
            break;
        }
        continue;
      }
      const params = resolveValue(
        action.params,
        'actionParams',
        makeScope(x, { params: x.params }),
        '$.actions.params'
      );
      const definition = json.actions?.[action.type];
      if (!definition) {
        enq(x.actions[action.type], params);
        continue;
      }
      if (stack.includes(action.type)) {
        throw new Error(
          `Circular action reference: ${stack.concat(action.type).join(' -> ')}`
        );
      }
      const definitions = Array.isArray(definition) ? definition : [definition];
      const result = executeActions(
        definitions,
        { ...x, context: { ...x.context, ...context }, params },
        enq,
        stack.concat(action.type)
      );
      if (result.context) context = result.context;
    }
    return { context: context ? { ...x.context, ...context } : undefined };
  }

  function iterActions(actions: ActionJSON | ActionJSON[]) {
    const actionArray = toActionArray(actions);
    return ((x: any, enq: any) =>
      executeActions(actionArray, x, enq)) as Action<
      any,
      any,
      any,
      any,
      any,
      any,
      any,
      any,
      any
    >;
  }

  function getTransitionConfig(
    transition: TransitionConfigJSON | TransitionConfigJSON[]
  ): any {
    const transitions = Array.isArray(transition) ? transition : [transition];
    return transitions.map((item, index) => {
      if (isResolvable(item)) {
        return (x: any, enq: any) =>
          evaluateResolvable(
            item,
            'transition',
            makeScope(x, { enq }),
            `$.transition${transitions.length > 1 ? `[${index}]` : ''}`
          );
      }
      const context = item.context
        ? (x: any) =>
            resolveValue(
              item.context,
              'transitionContext',
              makeScope(x),
              '$.transition.context'
            ) as MachineContext
        : undefined;
      const input =
        item.input !== undefined
          ? (x: any) =>
              resolveValue(
                item.input,
                'input',
                makeScope(x),
                '$.transition.input'
              )
          : undefined;
      const dynamic = !!context || !!item.actions?.length;
      return {
        matches: item.matches,
        target: dynamic ? undefined : item.target,
        to: dynamic
          ? (x: any, enq: any) => {
              const resolvedContext = context?.(x);
              const result = item.actions?.length
                ? executeActions(
                    item.actions,
                    resolvedContext
                      ? { ...x, context: { ...x.context, ...resolvedContext } }
                      : x,
                    enq
                  )
                : undefined;
              return {
                target: item.target,
                context: result?.context ?? resolvedContext,
                reenter: item.reenter
              };
            }
          : undefined,
        guard: resolveCondition(item.guard, 'guard', '$.transition.guard'),
        description: item.description,
        reenter: item.reenter,
        meta: item.meta,
        input
      };
    });
  }

  function iterInvokeConfigs(invokes: InvokeJSON | InvokeJSON[]): any {
    return (Array.isArray(invokes) ? invokes : [invokes]).map((inv) => ({
      src: resolvedSources.actors[inv.src] ?? inv.src,
      id: inv.id,
      registryKey: inv.registryKey,
      input:
        inv.input !== undefined
          ? (args: any) =>
              resolveValue(
                inv.input,
                'input',
                makeScope(args),
                '$.invoke.input'
              )
          : undefined,
      onDone: inv.onDone ? getTransitionConfig(inv.onDone) : undefined,
      onError: inv.onError ? getTransitionConfig(inv.onError) : undefined,
      onSnapshot: inv.onSnapshot
        ? getTransitionConfig(inv.onSnapshot)
        : undefined,
      timeout: getDurationConfig(inv.timeout, '$.invoke.timeout'),
      onTimeout: inv.onTimeout ? getTransitionConfig(inv.onTimeout) : undefined
    }));
  }

  function iterNode(node: StateNodeJSON, nodeKey?: string): any {
    return {
      id: node.id,
      initial: node.initial,
      type: node.type,
      history: node.history,
      target: node.target,
      description: node.description,
      tags: node.tags,
      input: node.input,
      timeout: getDurationConfig(node.timeout, `$.states.${nodeKey}.timeout`),
      states: node.states
        ? Object.fromEntries(
            Object.entries(node.states).map(([key, value]) => [
              key,
              iterNode(value, key)
            ])
          )
        : undefined,
      on: node.on
        ? Object.fromEntries(
            Object.entries(node.on).map(([key, value]) => [
              key,
              getTransitionConfig(value)
            ])
          )
        : undefined,
      always: node.always ? getTransitionConfig(node.always) : undefined,
      onError: node.onError ? getTransitionConfig(node.onError) : undefined,
      choice: makeChoiceConfig(node.choice, `$.states.${nodeKey}.choice`),
      route: resolveRouteConfig(node.route, `$.states.${nodeKey}.route`),
      after: node.after
        ? Object.fromEntries(
            Object.entries(node.after).map(([key, value]) => [
              key,
              getTransitionConfig(value)
            ])
          )
        : undefined,
      onTimeout: node.onTimeout
        ? getTransitionConfig(node.onTimeout)
        : undefined,
      entry: node.entry ? iterActions(node.entry) : undefined,
      exit: node.exit ? iterActions(node.exit) : undefined,
      invoke: node.invoke ? iterInvokeConfigs(node.invoke) : undefined,
      meta: node.meta,
      output: isResolvable(node.output)
        ? ({ context, event, self }: any) =>
            evaluateResolvable(
              node.output as ResolvableJSON,
              'output',
              { context, event, self },
              `$.states.${nodeKey}.output`
            )
        : node.output
    };
  }

  if (json.delays) {
    for (const [key, delay] of Object.entries(json.delays)) {
      if (typeof delay === 'number') resolvedSources.delays[key] = delay;
      else if (typeof delay === 'string')
        resolvedSources.delays[key] = delayToMs(delay);
      else if (delay && typeof delay === 'object') {
        resolvedSources.delays[key] = (args: any) =>
          delayToMs(
            resolveValue(
              delay.duration,
              'delay',
              makeScope(args),
              `$.delays.${key}.duration`
            ) as string | number
          );
      }
    }
  }

  assertMachineJSON(json, resolvedSources, expressionResolver);
  const contextConfig = json.context
    ? {
        context: (args: any) =>
          resolveValue(
            json.context,
            'context',
            args,
            '$.context'
          ) as MachineContext
      }
    : {};
  const machine = createMachine({
    ...iterNode(json),
    ...contextConfig,
    version: json.version
  }) as unknown as AnyStateMachine;
  const provided = machine.provide({
    actions: resolvedSources.actions,
    actors: resolvedSources.actors,
    guards: {
      'xstate.stateIn': (args: any, params: any) => {
        const stateId = params?.stateId as string;
        const snapshot = args._snapshot;
        return (
          !!stateId &&
          !!snapshot?.nodes?.some(
            (node: any) => node.id === stateId.replace(/^#/, '')
          )
        );
      },
      'xstate.not': (args: any, params: any) => {
        const inner = params?.guard;
        const impl = inner && args.guards?.[inner.type];
        if (!impl)
          throw new Error(
            `Guard '${inner?.type}' referenced by 'xstate.not' is not implemented.`
          );
        return !impl(args, inner.params);
      },
      ...resolvedSources.guards
    },
    delays: resolvedSources.delays
  });
  (provided as any)._json = json;
  return provided;
}

function isBuiltInActionJSON(action: ActionJSON): action is BuiltInActionJSON {
  return !isResolvable(action) && action.type.startsWith('@xstate.');
}
