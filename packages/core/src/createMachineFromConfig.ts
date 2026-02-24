import {
  Action,
  AnyEventObject,
  AnyStateMachine,
  EventObject,
  MachineContext,
  MetaObject
} from './types';
import {
  Next_InvokeConfig,
  Next_StateNodeConfig,
  Next_TransitionConfigOrTarget
} from './types.v6';
import { createMachine } from './createMachine';

function delayToMs(delay: string | number): number {
  if (typeof delay === 'number') return delay;
  const millisecondsMatch = delay.match(/^(\d+)ms$/);
  if (millisecondsMatch) return parseInt(millisecondsMatch[1], 10);
  const secondsMatch = delay.match(/^(\d*)(\.?)(\d*)s$/);
  if (secondsMatch) {
    const wholePart = secondsMatch[1] ? parseInt(secondsMatch[1], 10) : 0;
    const hasDecimal = !!secondsMatch[2];
    const fracPart = secondsMatch[3]
      ? parseInt(secondsMatch[3].padEnd(3, '0').slice(0, 3), 10)
      : 0;
    return wholePart * 1000 + (hasDecimal ? fracPart : 0);
  }
  return parseFloat(delay) || 0;
}

export interface RaiseJSON {
  type: '@xstate.raise';
  event: EventObject;
  id?: string;
  delay?: number;
}

export interface CancelJSON {
  type: '@xstate.cancel';
  id: string;
}

export interface LogJSON {
  type: '@xstate.log';
  args: any[];
}

export interface EmitJSON {
  type: '@xstate.emit';
  event: AnyEventObject;
}

export interface AssignJSON {
  type: '@xstate.assign';
  context: MachineContext;
}

export interface ScxmlAssignJSON {
  type: 'scxml.assign';
  /** SCXML location attribute - the context property to assign to */
  location: string;
  /** SCXML expr attribute - expression to evaluate */
  expr: string;
}

export interface ScxmlRaiseJSON {
  type: 'scxml.raise';
  /** Event type, or undefined if using eventexpr */
  event?: string;
  /** Expression to evaluate for event type */
  eventexpr?: string;
  /** Params with expressions to evaluate */
  params?: Array<{ name: string; expr: string }>;
  id?: string;
  delay?: number;
  /** Expression for delay */
  delayexpr?: string;
  /** Static target (e.g. '#_parent') */
  target?: string;
  /** Expression for target */
  targetexpr?: string;
}

export interface ScxmlScriptJSON {
  type: 'scxml.script';
  /** The script code to execute */
  code: string;
}

export interface ScxmlIfJSON {
  type: 'scxml.if';
  branches: Array<{
    cond?: string;
    actions: ActionJSON[];
  }>;
}

export type BuiltInActionJSON =
  | RaiseJSON
  | CancelJSON
  | LogJSON
  | EmitJSON
  | AssignJSON;

export interface CustomActionJSON {
  type: string;
  params?: Record<string, unknown>;
}

export type ActionJSON =
  | CustomActionJSON
  | RaiseJSON
  | CancelJSON
  | LogJSON
  | EmitJSON
  | AssignJSON
  | ScxmlAssignJSON
  | ScxmlRaiseJSON
  | ScxmlScriptJSON
  | ScxmlIfJSON;

export interface GuardJSON {
  type: string;
  params?: Record<string, unknown>;
}

export interface InvokeJSON {
  id?: string;
  src: string;
  input?: Record<string, unknown>;
  onDone?: TransitionJSON | TransitionJSON[];
  onError?: TransitionJSON | TransitionJSON[];
  onSnapshot?: TransitionJSON | TransitionJSON[];
}

export interface TransitionJSON {
  target?: string | string[];
  actions?: ActionJSON[];
  guard?: GuardJSON;
  description?: string;
  reenter?: boolean;
  meta?: MetaObject;
}

export interface StateNodeJSON {
  id?: string;
  key?: string;
  type?: 'atomic' | 'compound' | 'parallel' | 'final' | 'history';
  initial?: string;
  states?: Record<string, StateNodeJSON>;
  on?: Record<string, TransitionJSON | TransitionJSON[]>;
  after?: Record<string, TransitionJSON | TransitionJSON[]>;
  always?: TransitionJSON | TransitionJSON[];
  invoke?: InvokeJSON | InvokeJSON[];
  entry?: ActionJSON[];
  exit?: ActionJSON[];
  meta?: MetaObject;
  description?: string;
  history?: 'shallow' | 'deep';
  target?: string;
  output?: unknown;
  context?: Record<string, unknown>;
}
export interface MachineJSON extends StateNodeJSON {
  version?: string;
}

/** Evaluates an SCXML expression with context variables available via `with`. */
function evaluateExpr(
  context: MachineContext,
  expr: string,
  event: AnyEventObject | null
): unknown {
  const scope =
    'const _sessionid = "NOT_IMPLEMENTED"; const _ioprocessors = "NOT_IMPLEMENTED";';
  const fnBody = `
${scope}
with (context) {
  return (${expr});
}
  `.trim();
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const fn = new Function('context', '_event', fnBody);
  // SCXML _event has: name, data, origin, origintype, etc.
  // For self-raised events, origin is #_internal
  // SCXML _event: internal events (from <raise>) have no origin/origintype.
  // External events (from <send>) have origin/origintype set by the I/O processor.
  // We tag <send> events with _scxmlOrigin to distinguish them.
  const SCXML_ORIGIN = '#_scxml_session';
  const SCXML_ORIGIN_TYPE = 'http://www.w3.org/TR/scxml/#SCXMLEventProcessor';
  const isExternal = event && (event as any)._scxmlExternal;
  const result = fn(
    context,
    event
      ? {
          name: event.type,
          data: event,
          ...(isExternal
            ? { origin: SCXML_ORIGIN, origintype: SCXML_ORIGIN_TYPE }
            : {})
        }
      : undefined
  );

  return result;
}

/** Executes an SCXML script block and returns updated context values. */
function executeScript(
  context: MachineContext,
  code: string
): Record<string, unknown> {
  // Create a proxy to track which properties are modified
  const updates: Record<string, unknown> = {};
  const contextKeys = Object.keys(context);

  // Build variable declarations and reassignment capture
  const varDeclarations = contextKeys
    .map((k) => `let ${k} = context.${k};`)
    .join('\n');
  const captureUpdates = contextKeys
    .map((k) => `updates.${k} = ${k};`)
    .join('\n');

  const fnBody = `
${varDeclarations}
${code}
${captureUpdates}
return updates;
  `;
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const fn = new Function('context', 'updates', fnBody);
  return fn(context, updates);
}

export function createMachineFromConfig(json: MachineJSON): AnyStateMachine {
  // Pending transition actions: set by .to functions, consumed by entry functions.
  // This bridges SCXML's exit→transition→entry action ordering with XState's
  // .to function receiving pre-exit context.
  // Map keyed by target state ID so parallel transitions don't overwrite each other.
  const pendingTransitionActionsMap: Record<string, ActionJSON[]> = {};

  // Ordered queue of ALL transition actions (targeted + targetless) for parallel
  // context sharing. In SCXML, all transition actions execute sequentially in
  // document order with a shared evolving data model.
  const allTransitionActions: ActionJSON[][] = [];
  // Pre-transition context saved when a targetless .to executes. Used by entry
  // functions to re-execute all transition actions from scratch when parallel
  // targetless transitions coexist with targeted transitions.
  let contextBeforeTargetless: MachineContext | null = null;

  function iterNode(node: StateNodeJSON, nodeKey?: string) {
    const originalEntryActions = node.entry;
    const stateId = node.id || nodeKey;

    // Wrap entry to first execute any pending transition actions, then normal entry.
    // This ensures SCXML execution order: exit → transition_actions → entry_actions
    // because pending transition actions are set by .to (before exit) but executed
    // in entry (after exit), thus seeing post-exit context.
    const entryFn: Action<any, any, any, any, any, any, any> | undefined = (
      x,
      enq
    ) => {
      let context: MachineContext | undefined;

      // If targetless transitions were interleaved with targeted transitions
      // (parallel state), re-execute ALL transition actions from the original
      // pre-transition context. This overrides any .to-produced context with
      // the correct SCXML document-order sequential execution.
      // Only trigger when BOTH targeted (pending in map) and targetless fired
      // in the same microstep — prevents stale data from previous events.
      if (
        contextBeforeTargetless &&
        allTransitionActions.length > 0 &&
        Object.keys(pendingTransitionActionsMap).length > 0
      ) {
        let ctx = contextBeforeTargetless;
        for (const actions of allTransitionActions) {
          const mergedX = { ...x, context: ctx };
          const result = executeActions(actions, mergedX, enq);
          if (result.context) {
            ctx = result.context;
          }
        }
        allTransitionActions.length = 0;
        contextBeforeTargetless = null;
        // Clear per-target map since we re-processed everything
        for (const key of Object.keys(pendingTransitionActionsMap)) {
          delete pendingTransitionActionsMap[key];
        }
        context = ctx;
      } else {
        // Normal path: consume pending transition actions for THIS state.
        // In parallel states, each target gets its own pending actions.
        const transActions = stateId
          ? pendingTransitionActionsMap[stateId]
          : undefined;
        if (transActions) {
          delete pendingTransitionActionsMap[stateId!];
          const result = executeActions(transActions, x, enq);
          if (result.context) {
            context = result.context;
          }
        }
        // Clear stale targetless data from previous microsteps
        contextBeforeTargetless = null;
        allTransitionActions.length = 0;
      }

      // Execute normal entry actions
      if (originalEntryActions?.length) {
        const mergedX = context ? { ...x, context } : x;
        const result = executeActions(originalEntryActions, mergedX, enq);
        if (result.context) {
          context = result.context;
        }
      }

      return { context };
    };

    const nodeConfig: Next_StateNodeConfig<
      any,
      any,
      any,
      any,
      any,
      any,
      any,
      any,
      any,
      any,
      any
    > = {
      id: node.id,
      initial: node.initial,
      type: node.type,
      history: node.history,
      target: node.target,
      states: node.states
        ? Object.entries(node.states).reduce(
            (acc, [key, value]) => {
              acc[key] = iterNode(value, key);
              return acc;
            },
            {} as Record<
              string,
              Next_StateNodeConfig<
                any,
                any,
                any,
                any,
                any,
                any,
                any,
                any,
                any,
                any,
                any
              >
            >
          )
        : undefined,
      on: node.on
        ? Object.entries(node.on).reduce(
            (acc, [key, value]) => {
              acc[key] = getTransitionConfig(value);
              return acc;
            },
            {} as Record<
              string,
              Next_TransitionConfigOrTarget<
                any,
                any,
                any,
                any,
                any,
                any,
                any,
                any,
                any
              >
            >
          )
        : undefined,
      always: node.always ? getTransitionConfig(node.always) : undefined,
      // after: node.after,
      entry: entryFn,
      exit: node.exit ? iterActions(node.exit) : undefined,
      invoke: node.invoke ? iterInvokeConfigs(node.invoke) : undefined,
      meta: node.meta
    };

    return nodeConfig;
  }

  function iterInvokeConfigs(invokes: InvokeJSON | InvokeJSON[]): any {
    const invokeArray = Array.isArray(invokes) ? invokes : [invokes];
    return invokeArray.map((inv) => {
      const extInv = inv as InvokeJSON & { _nestedMachineJSON?: MachineJSON };
      // Create child machine from nested SCXML JSON
      let src: any;
      if (extInv._nestedMachineJSON) {
        src = createMachineFromConfig(extInv._nestedMachineJSON);
      } else {
        src = inv.src;
      }
      return {
        src,
        id: inv.id
      };
    });
  }

  /** Execute an array of SCXML action JSON descriptors with context and enqueue. */
  function executeActions(
    actions: ActionJSON[],
    x: any,
    enq: any
  ): { context: MachineContext | undefined } {
    let context: MachineContext | undefined;
    for (const action of actions) {
      if (isBuiltInActionJSON(action)) {
        switch (action.type) {
          case '@xstate.raise': {
            // Tag as external if it has a delay (from <send>, not <raise>)
            const event =
              action.delay !== undefined
                ? { ...action.event, _scxmlExternal: true }
                : action.event;
            enq.raise(event, {
              id: action.id,
              delay: action.delay
            });
            break;
          }
          case '@xstate.cancel':
            enq.cancel(action.id);
            break;
          case '@xstate.log':
            enq.log(...action.args);
            break;
          case '@xstate.emit':
            enq.emit(action.event);
            break;
          case '@xstate.assign':
            context ??= {};
            Object.assign(context, action.context);
            break;
          default:
            throw new Error(`Unknown built-in action: ${(action as any).type}`);
        }
      } else if (action.type === 'scxml.assign') {
        context ??= {};
        const scxmlAction = action as ScxmlAssignJSON;
        const mergedContext = { ...x.context, ...context };
        context[scxmlAction.location] = evaluateExpr(
          mergedContext,
          scxmlAction.expr,
          x.event
        );
      } else if (action.type === 'scxml.raise') {
        const scxmlAction = action as ScxmlRaiseJSON;
        const mergedContext = { ...x.context, ...context };

        const eventType = scxmlAction.eventexpr
          ? (evaluateExpr(
              mergedContext,
              scxmlAction.eventexpr,
              x.event
            ) as string)
          : scxmlAction.event || 'unknown';

        const eventData: Record<string, unknown> = { type: eventType };
        if (scxmlAction.params) {
          for (const param of scxmlAction.params) {
            eventData[param.name] = evaluateExpr(
              mergedContext,
              param.expr,
              x.event
            );
          }
        }

        const target = scxmlAction.targetexpr
          ? (evaluateExpr(
              mergedContext,
              scxmlAction.targetexpr,
              x.event
            ) as string)
          : scxmlAction.target;

        const isInternalTarget = target === '#_internal';
        const isParentTarget = target === '#_parent';
        const delay = scxmlAction.delayexpr
          ? delayToMs(
              evaluateExpr(mergedContext, scxmlAction.delayexpr, x.event) as
                | string
                | number
            )
          : isInternalTarget
            ? undefined
            : scxmlAction.delay;

        // Resolve target at runtime: parent, child, or self
        if (isParentTarget && x.parent) {
          // Send to parent via sendTo; pass delay if present
          enq.sendTo(
            x.parent,
            eventData as AnyEventObject,
            delay !== undefined ? { delay } : undefined
          );
        } else if (
          typeof target === 'string' &&
          target.startsWith('#_') &&
          !isParentTarget &&
          !isInternalTarget
        ) {
          // #_<invokeId> → try to send to child actor, fall back to self-raise
          const childId = target.slice(2); // strip '#_'
          const childRef = x.children?.[childId];
          if (childRef) {
            enq.sendTo(childRef, eventData as AnyEventObject);
          } else {
            // Not a known child (e.g. #_scxml_sessionid) → self-raise
            if (delay !== undefined) {
              (eventData as any)._scxmlExternal = true;
            }
            enq.raise(eventData as AnyEventObject, {
              id: scxmlAction.id,
              delay
            });
          }
        } else {
          // Self-send or no special target: raise as external event
          if (delay !== undefined) {
            (eventData as any)._scxmlExternal = true;
          }
          enq.raise(eventData as AnyEventObject, {
            id: scxmlAction.id,
            delay
          });
        }
      } else if (action.type === 'scxml.script') {
        context ??= {};
        const scxmlAction = action as ScxmlScriptJSON;
        const mergedContext = { ...x.context, ...context };
        const updatedContext = executeScript(mergedContext, scxmlAction.code);
        Object.assign(context, updatedContext);
      } else if (action.type === 'scxml.if') {
        const scxmlAction = action as ScxmlIfJSON;
        const mergedContext = { ...x.context, ...context };
        for (const branch of scxmlAction.branches) {
          const condResult = branch.cond
            ? !!evaluateExpr(mergedContext, branch.cond, x.event)
            : true;
          if (condResult) {
            if (branch.actions.length) {
              const branchX = { ...x, context: mergedContext };
              const branchResult = executeActions(branch.actions, branchX, enq);
              if (branchResult.context) {
                context ??= {};
                for (const key of Object.keys(branchResult.context)) {
                  if (branchResult.context[key] !== x.context[key]) {
                    context[key] = branchResult.context[key];
                  }
                }
              }
            }
            break;
          }
        }
      } else {
        enq(x.actions[action.type], (action as CustomActionJSON).params);
      }
    }
    return {
      context: context ? { ...x.context, ...context } : undefined
    };
  }

  function iterActions(
    actions: ActionJSON[]
  ): Action<any, any, any, any, any, any, any> {
    return (x, enq) => executeActions(actions, x, enq);
  }

  function getTransitionConfig(
    transition: TransitionJSON | TransitionJSON[]
  ): any {
    const transitions = Array.isArray(transition) ? transition : [transition];

    // Return an array of transition configs. Each SCXML transition becomes
    // a separate XState transition with its own guard and optional .to.
    // This ensures guards are evaluated by XState's evaluateCandidate (once,
    // with pre-exit context) and NOT re-evaluated in computeEntrySet.
    return transitions.map((t) => {
      const target = Array.isArray(t.target) ? t.target[0] : t.target;

      // No guard and no actions: simple static config
      if (!t.guard && !t.actions?.length) {
        return {
          target,
          description: t.description,
          reenter: t.reenter
        };
      }

      // Guard but no actions: static config with guard
      if (t.guard && !t.actions?.length) {
        return {
          target,
          guard: t.guard,
          description: t.description,
          reenter: t.reenter
        };
      }

      // Targetless transitions: execute actions directly in .to AND track for
      // parallel re-execution. For non-parallel, .to result is used directly.
      // For parallel (entries exist), first entry re-executes all in document order.
      if (!target) {
        return {
          guard: t.guard,
          to: (x: any, enq: any) => {
            if (t.actions?.length) {
              // Track for parallel re-execution (dedup by reference)
              if (!allTransitionActions.includes(t.actions)) {
                allTransitionActions.push(t.actions);
              }
              // Save pre-transition context for parallel override
              contextBeforeTargetless ??= x.context;
              // Execute immediately (fallback for non-parallel case)
              const result = executeActions(t.actions, x, enq);
              if (result.context) {
                return { context: result.context };
              }
            }
            return {};
          }
        };
      }

      // Has target + actions: use guard (for XState evaluation) + .to (for pending actions).
      // The .to function does NOT re-check the guard — XState's evaluateCandidate
      // already validated it. The .to just stores actions for entry to execute.
      // Map by target state ID so parallel transitions each get their own actions.
      return {
        guard: t.guard,
        to: (_x: any, _enq: any) => {
          if (t.actions?.length) {
            const targetId = target.replace(/^#/, '');
            pendingTransitionActionsMap[targetId] = t.actions;
            // Track for parallel re-execution (dedup by reference)
            if (!allTransitionActions.includes(t.actions)) {
              allTransitionActions.push(t.actions);
            }
          }
          return {
            target,
            reenter: t.reenter
          };
        }
      };
    });
  }

  function evaluateGuard(guard: GuardJSON, x: any): boolean {
    if (guard.type === 'scxml.cond') {
      const expr = guard.params?.expr as string;
      return expr ? !!evaluateExpr(x.context, expr, x.event) : true;
    }
    if (guard.type === 'xstate.stateIn') {
      const stateId = guard.params?.stateId as string;
      return (
        x.value != null &&
        JSON.stringify(x.value).includes(
          stateId.replace(/^#/, '').replace(/\$/g, '.')
        )
      );
    }
    if (guard.type === 'xstate.not') {
      const innerGuard = (guard.params as any)?.guard;
      if (innerGuard) {
        return !evaluateGuard(innerGuard, x);
      }
      return true;
    }
    // Custom guard
    const guardFn = x.guards?.[guard.type];
    return !guardFn || guardFn(guard.params);
  }

  const rootNodeConfig = iterNode(json);
  const contextConfig = json.context ? { context: json.context } : {};

  const machine = createMachine({
    ...rootNodeConfig,
    ...contextConfig
  } as any) as unknown as AnyStateMachine;

  // Register SCXML guard implementations
  return machine.provide({
    guards: {
      'scxml.cond': ({ context, event }, params) => {
        const expr = (params as any)?.expr as string;
        return expr ? !!evaluateExpr(context, expr, event) : true;
      },
      'xstate.stateIn': (_args, params) => {
        // This is handled by XState's built-in stateIn guard
        // but we provide a fallback
        return true;
      }
    }
  }) as AnyStateMachine;
}

function isBuiltInActionJSON(action: ActionJSON): action is BuiltInActionJSON {
  return action.type.startsWith('@xstate.');
}
