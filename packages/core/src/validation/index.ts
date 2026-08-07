import type { StandardSchemaV1 } from '../schema.types.ts';
import type {
  MachineValidationBoundary,
  MachineValidationEventOrigin,
  MachineValidationRequest,
  MachineValidator
} from '../validation.types.ts';

const machineValidationErrorSymbol = Symbol.for(
  'xstate.machineValidationError'
);

export type MachineValidationReason =
  | 'invalid'
  | 'unknownEvent'
  | 'unknownEmitted'
  | 'transformationUnsupported'
  | 'asyncValidationUnsupported'
  | 'schemaThrew';

export interface MachineValidationErrorOptions {
  reason: MachineValidationReason;
  boundary: MachineValidationBoundary;
  machineId: string;
  stateNodeId?: string;
  eventType?: string;
  eventOrigin?: MachineValidationEventOrigin;
  childId?: string;
  issues?: readonly StandardSchemaV1.Issue[];
  cause?: unknown;
}

/** A structured failure produced by `standardSchemaValidator()`. */
export class MachineValidationError extends Error {
  public readonly [machineValidationErrorSymbol] = true;
  public readonly reason: MachineValidationReason;
  public readonly boundary: MachineValidationBoundary;
  public readonly machineId: string;
  public readonly stateNodeId?: string;
  public readonly eventType?: string;
  public readonly eventOrigin?: MachineValidationEventOrigin;
  public readonly childId?: string;
  public readonly issues?: readonly StandardSchemaV1.Issue[];
  public override readonly cause?: unknown;

  constructor(options: MachineValidationErrorOptions) {
    super(getMessage(options), { cause: options.cause });
    this.name = 'MachineValidationError';
    this.reason = options.reason;
    this.boundary = options.boundary;
    this.machineId = options.machineId;
    this.stateNodeId = options.stateNodeId;
    this.eventType = options.eventType;
    this.eventOrigin = options.eventOrigin;
    this.childId = options.childId;
    this.issues = options.issues;
    this.cause = options.cause;
  }
}

export function isMachineValidationError(
  value: unknown
): value is MachineValidationError {
  return !!(
    value &&
    typeof value === 'object' &&
    machineValidationErrorSymbol in value
  );
}

export interface StandardSchemaValidatorOptions {
  unknownEvents?: 'error' | 'ignore';
  unknownEmitted?: 'error' | 'ignore';
}

interface ValidationTarget {
  schema: StandardSchemaV1 | undefined;
  value: unknown;
  boundary: MachineValidationBoundary;
  machineId: string;
  stateNodeId?: string;
  eventType?: string;
  eventOrigin?: MachineValidationEventOrigin;
  childId?: string;
}

/** Creates a synchronous, assertion-only Standard Schema validator. */
export function standardSchemaValidator(
  options: StandardSchemaValidatorOptions = {}
): MachineValidator {
  const unknownEvents = options.unknownEvents ?? 'error';
  const unknownEmitted = options.unknownEmitted ?? 'error';

  const checkTarget = (
    target: ValidationTarget
  ): MachineValidationError | undefined => {
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
    machine: MachineValidationRequest['machine'],
    event: { type: string; [key: string]: unknown },
    eventOrigin: MachineValidationEventOrigin
  ) => {
    if (
      !machine.schemas?.events ||
      event.type.startsWith('xstate.') ||
      event.type.startsWith('@xstate.')
    ) {
      return undefined;
    }
    return checkTarget({
      schema: machine.schemas.events[event.type],
      value: getPayload(event),
      boundary: 'event',
      machineId: machine.id,
      eventType: event.type,
      eventOrigin
    });
  };

  return {
    check(request) {
      const { machine } = request;

      if (request.kind === 'input') {
        return checkTarget({
          schema: machine.schemas?.input,
          value: request.input,
          boundary: 'input',
          machineId: machine.id
        });
      }

      if (request.kind === 'event') {
        return checkEvent(machine, request.event, request.eventOrigin);
      }

      const { snapshot, effects } = request;
      let error = checkTarget({
        schema: machine.schemas?.context,
        value: snapshot.context,
        boundary: 'context',
        machineId: machine.id
      });
      if (error) {
        return error;
      }

      for (const stateNode of snapshot._nodes) {
        error = checkTarget({
          schema: stateNode.schemas?.context,
          value: snapshot.context,
          boundary: 'state.context',
          machineId: machine.id,
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
            machineId: machine.id,
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
            machineId: machine.id,
            childId
          });
          if (error) {
            return error;
          }
        }
      }

      if (snapshot.status === 'done') {
        error = checkTarget({
          schema: machine.schemas?.output,
          value: snapshot.output,
          boundary: 'output',
          machineId: machine.id
        });
        if (error) {
          return error;
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

      for (const effect of effects) {
        if (effect.kind === 'emit' && machine.schemas?.emitted) {
          error = checkTarget({
            schema: machine.schemas.emitted[effect.event.type],
            value: getPayload(effect.event),
            boundary: 'emitted',
            machineId: machine.id,
            eventType: effect.event.type
          });
          if (error) {
            return error;
          }
        }
      }

      return undefined;
    }
  };
}

function createError(
  request: ValidationTarget,
  reason: MachineValidationReason,
  issues?: readonly StandardSchemaV1.Issue[],
  cause?: unknown
): MachineValidationError {
  return new MachineValidationError({
    reason,
    boundary: request.boundary,
    machineId: request.machineId,
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

function getPayload(event: {
  type: string;
  [key: string]: unknown;
}): Record<string, unknown> {
  const { type: _, ...payload } = event;
  return payload;
}

function getMessage(options: MachineValidationErrorOptions): string {
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
  MachineValidationBoundary,
  MachineValidationEventOrigin,
  MachineValidationRequest,
  MachineValidator
} from '../validation.types.ts';
