import type { StandardSchemaV1 } from '../schema.types.ts';
import type {
  ActorValidationBoundary,
  ActorValidationEventOrigin,
  ActorLogicValidator
} from '../validation.types.ts';
import type {
  AnyActorLogic,
  AnyMachineSnapshot,
  AnyStateMachine,
  ExecutableActionObject
} from '../types.ts';

const actorValidationErrorSymbol = Symbol.for('xstate.actorValidationError');

export type ActorValidationReason =
  | 'invalid'
  | 'unknownEvent'
  | 'unknownEmitted'
  | 'transformationUnsupported'
  | 'asyncValidationUnsupported'
  | 'schemaThrew';

export interface ActorValidationErrorOptions {
  reason: ActorValidationReason;
  boundary: ActorValidationBoundary;
  logicId?: string;
  stateNodeId?: string;
  eventType?: string;
  eventOrigin?: ActorValidationEventOrigin;
  childId?: string;
  issues?: readonly StandardSchemaV1.Issue[];
  cause?: unknown;
}

/** A structured failure produced by `standardSchemaValidator()`. */
export class ActorValidationError extends Error {
  public readonly [actorValidationErrorSymbol] = true;
  public readonly reason: ActorValidationReason;
  public readonly boundary: ActorValidationBoundary;
  public readonly logicId?: string;
  public readonly stateNodeId?: string;
  public readonly eventType?: string;
  public readonly eventOrigin?: ActorValidationEventOrigin;
  public readonly childId?: string;
  public readonly issues?: readonly StandardSchemaV1.Issue[];
  public override readonly cause?: unknown;

  constructor(options: ActorValidationErrorOptions) {
    super(getMessage(options), { cause: options.cause });
    this.name = 'ActorValidationError';
    this.reason = options.reason;
    this.boundary = options.boundary;
    this.logicId = options.logicId;
    this.stateNodeId = options.stateNodeId;
    this.eventType = options.eventType;
    this.eventOrigin = options.eventOrigin;
    this.childId = options.childId;
    this.issues = options.issues;
    this.cause = options.cause;
  }
}

export function isActorValidationError(
  value: unknown
): value is ActorValidationError {
  return !!(
    value &&
    typeof value === 'object' &&
    actorValidationErrorSymbol in value
  );
}

export interface StandardSchemaValidatorOptions {
  unknownEvents?: 'error' | 'ignore';
  unknownEmitted?: 'error' | 'ignore';
}

interface ValidationTarget {
  schema: StandardSchemaV1 | undefined;
  value: unknown;
  boundary: ActorValidationBoundary;
  logicId?: string;
  stateNodeId?: string;
  eventType?: string;
  eventOrigin?: ActorValidationEventOrigin;
  childId?: string;
}

interface ActorSchemas {
  input?: StandardSchemaV1;
  output?: StandardSchemaV1;
  events?: Record<string, StandardSchemaV1>;
  emitted?: Record<string, StandardSchemaV1>;
}

/** Creates a synchronous, assertion-only Standard Schema validator. */
export function standardSchemaValidator(
  options: StandardSchemaValidatorOptions = {}
): ActorLogicValidator {
  const unknownEvents = options.unknownEvents ?? 'error';
  const unknownEmitted = options.unknownEmitted ?? 'error';

  const checkTarget = (
    target: ValidationTarget
  ): ActorValidationError | undefined => {
    if (!target.schema) {
      if (target.boundary === 'event' && unknownEvents === 'error') {
        return createError(target, 'unknownEvent');
      }
      if (target.boundary === 'emitted' && unknownEmitted === 'error') {
        return createError(target, 'unknownEmitted');
      }
      return undefined;
    }

    let result:
      | StandardSchemaV1.Result<unknown>
      | Promise<StandardSchemaV1.Result<unknown>>;
    try {
      result = target.schema['~standard'].validate(target.value);
    } catch (cause) {
      return createError(target, 'schemaThrew', undefined, cause);
    }

    if (isPromiseLike(result)) {
      void Promise.resolve(result).catch(() => {});
      return createError(target, 'asyncValidationUnsupported');
    }

    if (result.issues) {
      return createError(target, 'invalid', result.issues);
    }

    return undefined;
  };

  const checkEvent = (
    logic: AnyActorLogic,
    event: { type: string; [key: string]: unknown },
    eventOrigin: ActorValidationEventOrigin
  ) => {
    const schemas = getSchemas(logic);
    if (
      !schemas?.events ||
      event.type.startsWith('xstate.') ||
      event.type.startsWith('@xstate.')
    ) {
      return undefined;
    }
    return checkTarget({
      schema: schemas.events[event.type],
      value: getPayload(event),
      boundary: 'event',
      logicId: getLogicId(logic),
      eventType: event.type,
      eventOrigin
    });
  };

  const checkEmitted = (
    logic: AnyActorLogic,
    effects: readonly ExecutableActionObject[]
  ) => {
    const schemas = getSchemas(logic);
    if (!schemas?.emitted) {
      return undefined;
    }
    for (const effect of effects) {
      if (effect.kind !== 'emit') {
        continue;
      }
      const error = checkTarget({
        schema: schemas.emitted[effect.event.type],
        value: getPayload(effect.event),
        boundary: 'emitted',
        logicId: getLogicId(logic),
        eventType: effect.event.type
      });
      if (error) {
        return error;
      }
    }
    return undefined;
  };

  const checkMachineResult = (
    machine: AnyStateMachine,
    snapshot: AnyMachineSnapshot
  ) => {
    let error = checkTarget({
      schema: machine.schemas?.context,
      value: snapshot.context,
      boundary: 'context',
      logicId: machine.id
    });
    if (error) {
      return error;
    }

    for (const stateNode of snapshot.nodes) {
      // the root state node reuses the machine-level `schemas` object, which is
      // already validated above and elsewhere; those are not state-local
      if (stateNode === machine.root) {
        continue;
      }
      error = checkTarget({
        schema: stateNode.schemas?.context,
        value: snapshot.context,
        boundary: 'state.context',
        logicId: machine.id,
        stateNodeId: stateNode.id
      });
      if (error) {
        return error;
      }
      if (stateNode.schemas?.input) {
        error = checkTarget({
          schema: stateNode.schemas.input,
          value: snapshot._stateInputs[stateNode.id],
          boundary: 'state.input',
          logicId: machine.id,
          stateNodeId: stateNode.id
        });
        if (error) {
          return error;
        }
      }
    }

    for (const childId of Object.keys(machine.schemas?.children ?? {})) {
      const child = snapshot.children[childId];
      if (child !== undefined) {
        error = checkTarget({
          schema: machine.schemas!.children![childId],
          value: child,
          boundary: 'child',
          logicId: machine.id,
          childId
        });
        if (error) {
          return error;
        }
      }
    }

    for (const timer of Object.values(snapshot.timers)) {
      if (timer.type === '@xstate.raise') {
        error = checkEvent(machine, timer.event, 'raised');
        if (error) {
          return error;
        }
      }
    }

    return undefined;
  };

  return {
    check(request) {
      const { logic } = request;
      const schemas = getSchemas(logic);

      if (request.kind === 'input') {
        return checkTarget({
          schema: schemas?.input,
          value: request.input,
          boundary: 'input',
          logicId: getLogicId(logic)
        });
      }

      if (request.kind === 'event') {
        return checkEvent(logic, request.event, request.eventOrigin);
      }

      const { snapshot, effects } = request;
      if (isStateMachine(logic)) {
        const error = checkMachineResult(logic, snapshot as AnyMachineSnapshot);
        if (error) {
          return error;
        }
      }

      if (snapshot.status === 'done') {
        const error = checkTarget({
          schema: schemas?.output,
          value: snapshot.output,
          boundary: 'output',
          logicId: getLogicId(logic)
        });
        if (error) {
          return error;
        }
      }

      return checkEmitted(logic, effects);
    }
  };
}

function createError(
  request: ValidationTarget,
  reason: ActorValidationReason,
  issues?: readonly StandardSchemaV1.Issue[],
  cause?: unknown
): ActorValidationError {
  return new ActorValidationError({
    reason,
    boundary: request.boundary,
    ...(request.logicId === undefined ? {} : { logicId: request.logicId }),
    ...(request.stateNodeId === undefined
      ? {}
      : { stateNodeId: request.stateNodeId }),
    ...(request.eventType === undefined
      ? {}
      : { eventType: request.eventType }),
    ...(request.eventOrigin === undefined
      ? {}
      : { eventOrigin: request.eventOrigin }),
    ...(request.childId === undefined ? {} : { childId: request.childId }),
    ...(issues === undefined ? {} : { issues }),
    ...(cause === undefined ? {} : { cause })
  });
}

function isStateMachine(logic: AnyActorLogic): logic is AnyStateMachine {
  return 'root' in logic && 'schemas' in logic;
}

function getSchemas(logic: AnyActorLogic): ActorSchemas | undefined {
  if (isStateMachine(logic)) {
    return logic.schemas;
  }
  return (logic.config as { schemas?: ActorSchemas } | undefined)?.schemas;
}

function getLogicId(logic: AnyActorLogic): string | undefined {
  return 'id' in logic && typeof logic.id === 'string' ? logic.id : undefined;
}

function getPayload(event: {
  type: string;
  [key: string]: unknown;
}): Record<string, unknown> {
  const { type: _, ...payload } = event;
  return payload;
}

function getMessage(options: ActorValidationErrorOptions): string {
  const subject =
    options.eventType !== undefined
      ? ` "${options.eventType}"`
      : options.childId !== undefined
        ? ` "${options.childId}"`
        : '';

  switch (options.reason) {
    case 'unknownEvent':
      return `Unknown event${subject}`;
    case 'unknownEmitted':
      return `Unknown emitted event${subject}`;
    case 'asyncValidationUnsupported':
      return `Async schema validation is unsupported for ${options.boundary}${subject}`;
    case 'transformationUnsupported':
      return `Schema transformations are unsupported for ${options.boundary}${subject}`;
    case 'schemaThrew':
      return `Schema threw while validating ${options.boundary}${subject}`;
    case 'invalid':
      return `Invalid ${options.boundary}${subject}`;
  }
}

function isPromiseLike<T>(value: T | PromiseLike<T>): value is PromiseLike<T> {
  return !!value && typeof (value as any).then === 'function';
}

export type {
  ActorValidationBoundary,
  ActorValidationEventOrigin,
  ActorValidationRequest,
  ActorLogicValidator
} from '../validation.types.ts';
