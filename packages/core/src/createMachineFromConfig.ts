import {
  Action,
  AnyActorRef,
  AnyEventObject,
  AnyStateMachine,
  EventObject,
  MachineContext,
  MetaObject
} from './types';
import {
  Next_StateNodeConfig,
  Next_TransitionConfigOrTarget
} from './types.v6';
import { createMachine } from './createMachine';
import { parseDelayToMilliseconds } from './delay';

function delayToMs(delay: string | number): number {
  const parsedDelay = parseDelayToMilliseconds(delay);
  if (parsedDelay !== undefined) return parsedDelay;
  return typeof delay === 'string' ? parseFloat(delay) || 0 : delay;
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

export interface ScxmlForeachJSON {
  type: 'scxml.foreach';
  array: string;
  item: string;
  index?: string;
  actions: ActionJSON[];
}

export interface ScxmlCancelJSON {
  type: 'scxml.cancel';
  sendidexpr: string;
}

export interface ScxmlDonedataJSON {
  params?: Array<{ name: string; expr: string }>;
  contentExpr?: string;
  contentText?: string;
}

/**
 * Isolated executable-content block. Errors in nested actions stop this block
 * but do not propagate to the surrounding action list. Used to model SCXML's
 * separate <onentry>/<onexit> blocks: each is its own block per spec.
 */
export interface ScxmlBlockJSON {
  type: 'scxml.block';
  actions: ActionJSON[];
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
  | ScxmlIfJSON
  | ScxmlForeachJSON
  | ScxmlCancelJSON
  | ScxmlBlockJSON;

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
  type?: 'atomic' | 'compound' | 'parallel' | 'final' | 'history' | 'choice';
  initial?: string;
  states?: Record<string, StateNodeJSON>;
  on?: Record<string, TransitionJSON | TransitionJSON[]>;
  after?: Record<string, TransitionJSON | TransitionJSON[]>;
  always?: TransitionJSON | TransitionJSON[];
  choices?: TransitionJSON[];
  invoke?: InvokeJSON | InvokeJSON[];
  entry?: ActionJSON[];
  exit?: ActionJSON[];
  meta?: MetaObject;
  description?: string;
  history?: 'shallow' | 'deep';
  target?: string;
  output?: unknown;
  context?: Record<string, unknown>;
  _scxmlDonedata?: ScxmlDonedataJSON;
}
export interface MachineJSON extends StateNodeJSON {
  version?: string;
}

let _scxmlSessionId = 'session_' + Math.random().toString(36).slice(2);
let _scxmlMachineName = '';

/** Evaluates an SCXML expression with context variables available via `with`. */
function evaluateExpr(
  context: MachineContext,
  expr: string,
  event: AnyEventObject | null,
  self?: AnyActorRef
): unknown {
  const fnBody = `
with (context) {
  return (${expr});
}
  `.trim();
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const fn = new Function(
    'context',
    '_event',
    '_sessionid',
    '_name',
    '_ioprocessors',
    'In',
    fnBody
  );
  const In = (stateId: string) => {
    if (!self) return false;
    try {
      const snap = (self as any).getSnapshot?.();
      if (snap?._nodes) {
        const sanitized = stateId.replace(/\./g, '$');
        return snap._nodes.some(
          (node: any) =>
            node.id === sanitized || node.id.endsWith('.' + sanitized)
        );
      }
    } catch {
      // ignore
    }
    return false;
  };
  const SCXML_ORIGIN = '#_scxml_session';
  const SCXML_ORIGIN_TYPE = 'http://www.w3.org/TR/scxml/#SCXMLEventProcessor';
  const isExternal = event && (event as any)._scxmlExternal;
  const isInitEvent = event && event.type === '@xstate.init';
  // Per SCXML spec, _event has these fields. Fields that don't apply to a
  // particular event are present with value `undefined` (so `'name' in _event`
  // is true but `typeof _event.name === 'undefined'` for unset fields).
  // For xstate.done.* events, _event.data is the `output` payload (matches
  // SCXML's done event semantics where data is the donedata).
  const isDoneEvent =
    event &&
    typeof event.type === 'string' &&
    event.type.startsWith('xstate.done.');
  const explicitType =
    event && ((event as any)._scxmlEventType as string | undefined);
  const scxmlEvent =
    event && !isInitEvent
      ? {
          name: event.type,
          type: explicitType || (isExternal ? 'external' : 'internal'),
          sendid: (event as any)._scxmlSendId as string | undefined,
          origin: isExternal ? SCXML_ORIGIN : undefined,
          origintype: isExternal ? SCXML_ORIGIN_TYPE : undefined,
          invokeid: (event as any)._scxmlInvokeId as string | undefined,
          data: isDoneEvent
            ? (event as any).output
            : (event as any)._scxmlEventData !== undefined
              ? (event as any)._scxmlEventData
              : event
        }
      : undefined;
  const result = fn(
    context,
    scxmlEvent,
    _scxmlSessionId,
    _scxmlMachineName,
    { scxml: { location: `#_scxml_${_scxmlSessionId}` } },
    In
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
  // Platform errors collected during transition selection (e.g., failing
  // <transition cond>). Drained by the next state's entry into the internal
  // event queue so they're processed before any external events.
  const pendingPlatformErrors: Array<Record<string, unknown>> = [];

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
      // Drain any platform errors queued during transition selection (e.g.,
      // failing <transition cond="..."> evaluations). These must be raised
      // internally so they're processed before subsequent external events.
      while (pendingPlatformErrors.length) {
        const err = pendingPlatformErrors.shift()!;
        enq.raise({
          type: 'error.execution',
          _scxmlEventType: 'platform',
          _scxmlEventData: err
        } as AnyEventObject);
      }

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

    const nodeConfig: any = {
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
      choices: node.choices ? getTransitionConfig(node.choices) : undefined,
      // after: node.after,
      entry: entryFn as any,
      exit: node.exit ? (iterActions(node.exit) as any) : undefined,
      invoke: node.invoke ? iterInvokeConfigs(node.invoke) : undefined,
      meta: node.meta,
      output: node._scxmlDonedata
        ? makeDonedataOutput(node._scxmlDonedata)
        : undefined
    };

    return nodeConfig;
  }

  function makeDonedataOutput(donedata: ScxmlDonedataJSON) {
    return ({ context, event, self }: any) => {
      try {
        if (donedata.params && donedata.params.length) {
          const out: Record<string, unknown> = {};
          for (const param of donedata.params) {
            out[param.name] = evaluateExpr(context, param.expr, event, self);
          }
          return out;
        }
        if (donedata.contentExpr !== undefined) {
          return evaluateExpr(context, donedata.contentExpr, event, self);
        }
        if (donedata.contentText !== undefined) {
          // Try parsing as a JS expression (number/object/array literals);
          // fall back to the raw string.
          try {
            return evaluateExpr(context, donedata.contentText, event, self);
          } catch {
            return donedata.contentText;
          }
        }
      } catch (err) {
        // Per SCXML, donedata expression errors raise error.execution and
        // result in undefined event.data. Queue for the next entry to drain.
        const message =
          err instanceof Error ? err.message : String(err ?? 'unknown error');
        pendingPlatformErrors.push({
          tagname: 'donedata',
          message,
          line: NaN,
          column: NaN,
          reason: message
        });
      }
      return undefined;
    };
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

  /**
   * Raise an SCXML error.execution platform event onto the internal queue. Per
   * spec, error.execution is type='platform' and _event.data contains error
   * info. The surrounding block of executable content stops.
   */
  function raiseErrorExecution(
    state: ExecState,
    tagname: string,
    err: unknown
  ) {
    const message =
      err instanceof Error ? err.message : String(err ?? 'unknown error');
    state.enq.raise({
      type: 'error.execution',
      _scxmlEventType: 'platform',
      _scxmlEventData: {
        tagname,
        message,
        line: NaN,
        column: NaN,
        reason: message
      }
    } as AnyEventObject);
    state.errored = true;
  }

  interface ExecState {
    enq: any;
    errored: boolean;
  }

  /** Execute an array of SCXML action JSON descriptors with context and enqueue. */
  function executeActions(
    actions: ActionJSON[],
    x: any,
    enq: any,
    parentState?: ExecState
  ): { context: MachineContext | undefined; errored: boolean } {
    const state: ExecState = parentState ?? { enq, errored: false };
    let context: MachineContext | undefined;
    for (const action of actions) {
      if (state.errored) break;
      if (isBuiltInActionJSON(action)) {
        switch (action.type) {
          case '@xstate.raise': {
            // Tag as external if it has a delay (from <send>, not <raise>).
            // Attach _scxmlSendId so _event.sendid can be read in expressions.
            const isExternal = action.delay !== undefined;
            const event =
              isExternal || action.id !== undefined
                ? {
                    ...action.event,
                    ...(isExternal ? { _scxmlExternal: true } : {}),
                    ...(action.id !== undefined
                      ? { _scxmlSendId: action.id }
                      : {})
                  }
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
        const scxmlAction = action as ScxmlAssignJSON;
        const mergedContext = { ...x.context, ...context };
        let value: unknown;
        try {
          value = evaluateExpr(
            mergedContext,
            scxmlAction.expr,
            x.event,
            x.self
          );
        } catch (err) {
          raiseErrorExecution(state, 'assign', err);
          continue;
        }
        // Per SCXML, assigning to a location that doesn't exist on the
        // datamodel is an error. Allow setting an own property via context;
        // detect deep paths (a.b.c) which we don't support.
        if (scxmlAction.location.includes('.')) {
          raiseErrorExecution(
            state,
            'assign',
            new Error(`Invalid assign location: ${scxmlAction.location}`)
          );
          continue;
        }
        context ??= {};
        context[scxmlAction.location] = value;
      } else if (action.type === 'scxml.raise') {
        const scxmlAction = action as ScxmlRaiseJSON;
        const mergedContext = { ...x.context, ...context };

        let eventType: string;
        let eventData: Record<string, unknown>;
        let target: string | undefined;
        let delay: number | undefined;
        try {
          eventType = scxmlAction.eventexpr
            ? (evaluateExpr(
                mergedContext,
                scxmlAction.eventexpr,
                x.event,
                x.self
              ) as string)
            : scxmlAction.event || 'unknown';

          eventData = { type: eventType };
          if (scxmlAction.params) {
            for (const param of scxmlAction.params) {
              eventData[param.name] = evaluateExpr(
                mergedContext,
                param.expr,
                x.event,
                x.self
              );
            }
          }

          target = scxmlAction.targetexpr
            ? (evaluateExpr(
                mergedContext,
                scxmlAction.targetexpr,
                x.event,
                x.self
              ) as string)
            : scxmlAction.target;

          const isInternalTarget = target === '#_internal';
          delay = scxmlAction.delayexpr
            ? delayToMs(
                evaluateExpr(
                  mergedContext,
                  scxmlAction.delayexpr,
                  x.event,
                  x.self
                ) as string | number
              )
            : isInternalTarget
              ? undefined
              : scxmlAction.delay;
        } catch (err) {
          raiseErrorExecution(state, 'send', err);
          continue;
        }

        const isInternalTarget = target === '#_internal';
        const isParentTarget = target === '#_parent';

        // Validate target. SCXML targets must be '#_internal', '#_parent',
        // or '#_<id>'. A bare string without the '#_' prefix is invalid and
        // raises error.execution.
        if (
          typeof target === 'string' &&
          target.length > 0 &&
          !target.startsWith('#_')
        ) {
          raiseErrorExecution(
            state,
            'send',
            new Error(`Invalid send target: ${target}`)
          );
          continue;
        }
        // Attach send id so _event.sendid can be read in expressions.
        if (scxmlAction.id !== undefined) {
          (eventData as any)._scxmlSendId = scxmlAction.id;
        }
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
      } else if (action.type === 'scxml.cancel') {
        const scxmlAction = action as ScxmlCancelJSON;
        const mergedContext = { ...x.context, ...context };
        try {
          const sendId = evaluateExpr(
            mergedContext,
            scxmlAction.sendidexpr,
            x.event,
            x.self
          ) as string;
          if (sendId) {
            enq.cancel(sendId);
          }
        } catch {
          // ignore evaluation errors
        }
      } else if (action.type === 'scxml.script') {
        const scxmlAction = action as ScxmlScriptJSON;
        const mergedContext = { ...x.context, ...context };
        try {
          const updatedContext = executeScript(mergedContext, scxmlAction.code);
          context ??= {};
          Object.assign(context, updatedContext);
        } catch (err) {
          raiseErrorExecution(state, 'script', err);
        }
      } else if (action.type === 'scxml.foreach') {
        const scxmlAction = action as ScxmlForeachJSON;
        const mergedContext = { ...x.context, ...context };
        // SCXML: `item` (and `index` if present) must be valid datamodel
        // locations — i.e. legal identifiers. Reject things like 'continue'
        // (string literal) or '7' (number).
        const isLegalIdentifier = (s: string) =>
          /^[$_a-zA-Z][$_a-zA-Z0-9]*$/.test(s);
        if (
          !isLegalIdentifier(scxmlAction.item) ||
          (scxmlAction.index && !isLegalIdentifier(scxmlAction.index))
        ) {
          raiseErrorExecution(
            state,
            'foreach',
            new Error('foreach item/index is not a legal location')
          );
          continue;
        }
        let arr: unknown;
        try {
          arr = evaluateExpr(mergedContext, scxmlAction.array, x.event, x.self);
        } catch (err) {
          raiseErrorExecution(state, 'foreach', err);
          continue;
        }
        if (!Array.isArray(arr)) {
          raiseErrorExecution(
            state,
            'foreach',
            new Error('foreach array is not iterable')
          );
          continue;
        }
        context ??= {};
        for (let i = 0; i < arr.length; i++) {
          context[scxmlAction.item] = arr[i];
          if (scxmlAction.index) {
            context[scxmlAction.index] = i;
          }
          const iterX = { ...x, context: { ...x.context, ...context } };
          const iterResult = executeActions(
            scxmlAction.actions,
            iterX,
            enq,
            state
          );
          if (iterResult.context) {
            Object.assign(context, iterResult.context);
          }
          if (state.errored) break;
        }
      } else if (action.type === 'scxml.block') {
        const scxmlAction = action as ScxmlBlockJSON;
        const blockX = { ...x, context: { ...x.context, ...context } };
        // Block has its own ExecState — errors don't propagate to parent.
        const blockResult = executeActions(scxmlAction.actions, blockX, enq);
        if (blockResult.context) {
          context ??= {};
          for (const key of Object.keys(blockResult.context)) {
            if (blockResult.context[key] !== x.context[key]) {
              context[key] = blockResult.context[key];
            }
          }
        }
      } else if (action.type === 'scxml.if') {
        const scxmlAction = action as ScxmlIfJSON;
        const mergedContext = { ...x.context, ...context };
        for (const branch of scxmlAction.branches) {
          let condResult: boolean;
          if (branch.cond) {
            try {
              condResult = !!evaluateExpr(
                mergedContext,
                branch.cond,
                x.event,
                x.self
              );
            } catch (err) {
              raiseErrorExecution(state, 'if', err);
              condResult = false;
            }
          } else {
            condResult = true;
          }
          if (condResult) {
            if (branch.actions.length) {
              const branchX = { ...x, context: mergedContext };
              const branchResult = executeActions(
                branch.actions,
                branchX,
                enq,
                state
              );
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
      context: context ? { ...x.context, ...context } : undefined,
      errored: state.errored
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

  const rootNodeConfig = iterNode(json);
  const contextConfig = json.context ? { context: json.context } : {};

  _scxmlMachineName = json.id || '';
  _scxmlSessionId = 'session_' + Math.random().toString(36).slice(2);

  const machine = createMachine({
    ...rootNodeConfig,
    ...contextConfig
  }) as unknown as AnyStateMachine;

  // Register SCXML guard implementations
  return machine.provide({
    guards: {
      'scxml.cond': ({ context, event, self }: any, params: any) => {
        const expr = params?.expr as string;
        if (!expr) return true;
        try {
          return !!evaluateExpr(context, expr, event, self);
        } catch (err) {
          // Per SCXML spec, a cond that fails to evaluate is treated as false
          // AND raises error.execution. We can't enqueue from a guard, so
          // queue it for the next entry to drain.
          const message =
            err instanceof Error ? err.message : String(err ?? 'unknown error');
          pendingPlatformErrors.push({
            tagname: 'cond',
            message,
            line: NaN,
            column: NaN,
            reason: message
          });
          return false;
        }
      },
      'xstate.stateIn': (args: any, params: any) => {
        const stateId = params?.stateId as string;
        if (!stateId) return false;
        const normalizedId = stateId.replace(/^#/, '');
        const snapshot = args._snapshot;
        if (snapshot?._nodes) {
          return snapshot._nodes.some((node: any) => node.id === normalizedId);
        }
        return false;
      }
    }
  }) as AnyStateMachine;
}

function isBuiltInActionJSON(action: ActionJSON): action is BuiltInActionJSON {
  return action.type.startsWith('@xstate.');
}
