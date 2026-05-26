import { StandardSchemaV1 } from './schema.ts';
import {
  EventObject,
  EventPayloadMap,
  StoreContext,
  StoreEffect,
  StoreExtension,
  StoreSnapshot
} from './types.ts';
import { storeValidationErrorSymbol } from './validationError.ts';

type ValidationReason =
  | 'invalidContext'
  | 'invalidEvent'
  | 'invalidEmitted'
  | 'unknownEvent'
  | 'unknownEmitted'
  | 'asyncValidationUnsupported';

interface StoreValidationErrorOptions {
  reason: ValidationReason;
  eventType?: string;
  context?: unknown;
  payload?: unknown;
  issues?: unknown;
}

/** Error thrown by `validateSchemas()` when schema validation fails. */
export class StoreValidationError extends Error {
  public readonly [storeValidationErrorSymbol] = true;
  public readonly reason: ValidationReason;
  public readonly eventType?: string;
  public readonly context?: unknown;
  public readonly payload?: unknown;
  public readonly issues?: unknown;

  constructor(options: StoreValidationErrorOptions) {
    super(getStoreValidationErrorMessage(options));
    this.name = 'StoreValidationError';
    this.reason = options.reason;
    this.eventType = options.eventType;
    this.context = options.context;
    this.payload = options.payload;
    this.issues = options.issues;
  }
}

interface ValidateSchemasOptions {
  context?: boolean;
  events?: boolean;
  emitted?: boolean;
  unknownEvents?: 'throw' | 'ignore';
  unknownEmitted?: 'throw' | 'ignore';
}

const isDevelopment =
  (
    globalThis as {
      process?: {
        env?: {
          NODE_ENV?: string;
        };
      };
    }
  ).process?.env?.NODE_ENV !== 'production';

function getStoreValidationErrorMessage(options: StoreValidationErrorOptions) {
  switch (options.reason) {
    case 'invalidContext':
      return 'Invalid context';
    case 'invalidEvent':
      return `Invalid event "${options.eventType}"`;
    case 'invalidEmitted':
      return `Invalid emitted event "${options.eventType}"`;
    case 'unknownEvent':
      return `Unknown event "${options.eventType}"`;
    case 'unknownEmitted':
      return `Unknown emitted event "${options.eventType}"`;
    case 'asyncValidationUnsupported':
      return `Async schema validation is unsupported${
        options.eventType ? ` for event "${options.eventType}"` : ''
      }`;
  }
}

function isPromiseLike<T>(value: T | PromiseLike<T>): value is PromiseLike<T> {
  return !!value && typeof (value as any).then === 'function';
}

function getPayload(event: EventObject): object {
  const { type: _, ...payload } = event;
  return payload;
}

function hasAnySchemas(schemas: any): boolean {
  return !!(schemas?.context || schemas?.events || schemas?.emitted);
}

function validateSchema(
  schema: StandardSchemaV1,
  value: unknown,
  errorOptions: Omit<StoreValidationErrorOptions, 'issues'>
): void {
  const result = schema['~standard'].validate(value);

  if (isPromiseLike(result)) {
    throw new StoreValidationError({
      ...errorOptions,
      reason: 'asyncValidationUnsupported'
    });
  }

  if (result.issues) {
    throw new StoreValidationError({
      ...errorOptions,
      issues: result.issues
    });
  }
}

function validateEvent(
  event: EventObject,
  schemas: any,
  eventTypes: readonly string[] | undefined,
  unknownEvents: 'throw' | 'ignore'
): void {
  const eventSchemas = schemas.events;
  if (!eventSchemas) {
    return;
  }

  const payload = getPayload(event);
  const schema = eventSchemas[event.type];

  if (!schema) {
    if (eventTypes?.includes(event.type)) {
      return;
    }

    if (unknownEvents === 'throw') {
      throw new StoreValidationError({
        reason: 'unknownEvent',
        eventType: event.type,
        payload
      });
    }
    return;
  }

  validateSchema(schema, payload, {
    reason: 'invalidEvent',
    eventType: event.type,
    payload
  });
}

function validateContext(context: unknown, schemas: any): void {
  const schema = schemas.context;
  if (!schema) {
    return;
  }

  validateSchema(schema, context, {
    reason: 'invalidContext',
    context
  });
}

function validateEmitted(
  effect: EventObject,
  schemas: any,
  unknownEmitted: 'throw' | 'ignore'
): void {
  const emittedSchemas = schemas.emitted;
  if (!emittedSchemas) {
    return;
  }

  const payload = getPayload(effect);
  const schema = emittedSchemas[effect.type];

  if (!schema) {
    if (unknownEmitted === 'throw') {
      throw new StoreValidationError({
        reason: 'unknownEmitted',
        eventType: effect.type,
        payload
      });
    }
    return;
  }

  validateSchema(schema, payload, {
    reason: 'invalidEmitted',
    eventType: effect.type,
    payload
  });
}

/**
 * Validates schema-declared events, emitted events, and context at runtime.
 *
 * Validation is opt-in; stores with schemas only use those schemas for typing
 * and metadata unless this extension is applied.
 */
export function validateSchemas<
  TContext extends StoreContext,
  TEventPayloadMap extends EventPayloadMap,
  TEmitted extends EventObject
>(
  options: ValidateSchemasOptions = {}
): StoreExtension<TContext, TEventPayloadMap, {}, TEmitted> {
  return (logic) => {
    const schemas = logic.schemas;

    if (!hasAnySchemas(schemas)) {
      if (isDevelopment) {
        console.warn(
          'The "validateSchemas" store extension was used, but the store has no schemas to validate.'
        );
      }
      return logic;
    }

    const validateContextEnabled = options.context ?? true;
    const validateEventsEnabled = options.events ?? true;
    const validateEmittedEnabled = options.emitted ?? true;
    const unknownEvents = options.unknownEvents ?? 'throw';
    const unknownEmitted = options.unknownEmitted ?? 'throw';

    return {
      ...logic,
      getInitialSnapshot() {
        const snapshot = logic.getInitialSnapshot();

        if (validateContextEnabled) {
          validateContext(snapshot.context, schemas);
        }

        return snapshot;
      },
      transition(snapshot: StoreSnapshot<TContext>, event) {
        if (validateEventsEnabled) {
          validateEvent(event, schemas, logic.eventTypes, unknownEvents);
        }

        const result = logic.transition(snapshot, event);
        const [nextSnapshot, effects] = result;

        if (validateContextEnabled) {
          validateContext(nextSnapshot.context, schemas);
        }

        if (validateEmittedEnabled) {
          for (const effect of effects as StoreEffect<TEmitted>[]) {
            if (typeof effect !== 'function') {
              validateEmitted(effect, schemas, unknownEmitted);
            }
          }
        }

        return result;
      }
    };
  };
}
