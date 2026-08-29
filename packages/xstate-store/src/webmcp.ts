import type { AnyStore, EventFromStore, EventObject } from './types.ts';
import type { StandardSchemaV1 } from './schema.ts';

type PartialEventDescriptor<TEventType extends string> =
  TEventType extends `${infer TLeading}.${infer TTail}`
    ? `${TLeading}.*` | `${TLeading}.${PartialEventDescriptor<TTail>}`
    : never;

/** Event descriptors accepted by the WebMCP adapter. */
export type StoreEventDescriptor<TEvent extends EventObject> =
  | TEvent['type']
  | PartialEventDescriptor<TEvent['type']>
  | '*';

export type WebMCPEventDescriptor<TStore extends AnyStore> =
  StoreEventDescriptor<EventFromStore<TStore>>;

export interface WebMCPToolAnnotations {
  readOnlyHint?: boolean;
  untrustedContentHint?: boolean;
}

export interface WebMCPTool {
  name: string;
  title?: string;
  description: string;
  inputSchema?: Record<string, unknown>;
  annotations?: WebMCPToolAnnotations;
  execute: (input: Record<string, unknown>) => unknown | Promise<unknown>;
}

export interface WebMCPRegisterToolOptions {
  signal?: AbortSignal;
  exposedTo?: string[];
}

export interface WebMCPModelContext {
  registerTool(
    tool: WebMCPTool,
    options?: WebMCPRegisterToolOptions
  ): Promise<void>;
}

export type WebMCPStatus =
  | 'error'
  | 'idle'
  | 'ready'
  | 'registering'
  | 'unsupported';

export interface WebMCPInputErrorOptions {
  eventType: string;
  issues?: unknown;
}

/** Thrown when a WebMCP tool input fails its store event schema. */
export class WebMCPInputError extends Error {
  public readonly eventType: string;
  public readonly issues: unknown;

  constructor(options: WebMCPInputErrorOptions) {
    super(`Invalid input for WebMCP event "${options.eventType}"`);
    this.name = 'WebMCPInputError';
    this.eventType = options.eventType;
    this.issues = options.issues;
  }
}

export interface WebMCPAttachOptions<TStore extends AnyStore> {
  /** Event types or trailing-token wildcard descriptors to expose. */
  events:
    | WebMCPEventDescriptor<TStore>
    | readonly WebMCPEventDescriptor<TStore>[];
  /** Overrides the default document.modelContext, useful for tests and hosts. */
  modelContext?: WebMCPModelContext;
  /** Prefix applied to generated tool names. */
  prefix?: string;
  /** Maps an event type to its WebMCP tool name. */
  getToolName?: (eventType: string) => string;
  /** Converts schemas that do not implement Standard JSON Schema. */
  toJSONSchema?: (schema: StandardSchemaV1) => Record<string, unknown>;
}

export interface WebMCPAttachment {
  readonly error: unknown;
  readonly status: WebMCPStatus;
  readonly tools: readonly WebMCPTool[];
  start(): Promise<void>;
  stop(): void;
}

interface StandardJSONSchema extends StandardSchemaV1 {
  '~standard': StandardSchemaV1['~standard'] & {
    jsonSchema?: {
      input(options: { target: string }): Record<string, unknown>;
    };
  };
}

function isPromiseLike<T>(value: T | PromiseLike<T>): value is PromiseLike<T> {
  return !!value && typeof (value as { then?: unknown }).then === 'function';
}

function isValidEventDescriptor(descriptor: string): boolean {
  return (
    descriptor === '*' ||
    !descriptor.includes('*') ||
    (descriptor.endsWith('.*') && !descriptor.slice(0, -2).includes('*'))
  );
}

function assertValidEventDescriptor(descriptor: string): void {
  if (!isValidEventDescriptor(descriptor)) {
    throw new Error(
      `Invalid WebMCP event descriptor "${descriptor}". Wildcards must be the entire descriptor or the final token.`
    );
  }
}

/**
 * Checks whether an event type matches an exact, full, or trailing-token
 * wildcard descriptor.
 */
export function matchesStoreEventDescriptor(
  eventType: string,
  descriptor: string
): boolean {
  if (descriptor === eventType || descriptor === '*') {
    return true;
  }

  if (!descriptor.endsWith('.*') || !isValidEventDescriptor(descriptor)) {
    return false;
  }

  const prefixTokens = descriptor.slice(0, -2).split('.');
  const eventTokens = eventType.split('.');

  return prefixTokens.every((token, index) => token === eventTokens[index]);
}

function getEventDescriptors<TStore extends AnyStore>(
  events: WebMCPAttachOptions<TStore>['events']
): readonly string[] {
  return typeof events === 'string' ? [events] : events;
}

function resolveEventTypes<TStore extends AnyStore>(
  eventTypes: readonly string[],
  events: WebMCPAttachOptions<TStore>['events']
): string[] {
  const descriptors = getEventDescriptors(events);

  for (const descriptor of descriptors) {
    assertValidEventDescriptor(descriptor);
  }

  const selected = eventTypes.filter((eventType) =>
    descriptors.some((descriptor) =>
      matchesStoreEventDescriptor(eventType, descriptor)
    )
  );

  for (const descriptor of descriptors) {
    if (
      descriptor !== '*' &&
      !descriptor.endsWith('.*') &&
      !eventTypes.includes(descriptor)
    ) {
      throw new Error(
        `Unknown WebMCP event descriptor "${descriptor}". No matching event schema exists.`
      );
    }
  }

  return [...new Set(selected)];
}

function getDocumentModelContext(): WebMCPModelContext | undefined {
  const documentWithModelContext = (
    globalThis as {
      document?: { modelContext?: WebMCPModelContext };
    }
  ).document;

  return documentWithModelContext?.modelContext;
}

function getInputSchema(
  schema: StandardSchemaV1,
  toJSONSchema?: WebMCPAttachOptions<AnyStore>['toJSONSchema']
): Record<string, unknown> {
  if (toJSONSchema) {
    return toJSONSchema(schema);
  }

  const jsonSchema = (schema as StandardJSONSchema)['~standard'].jsonSchema;

  if (jsonSchema?.input) {
    return jsonSchema.input({ target: 'draft-07' });
  }

  throw new Error(
    'WebMCP requires event schemas that implement Standard JSON Schema or a toJSONSchema option.'
  );
}

function getToolName(
  eventType: string,
  options: WebMCPAttachOptions<AnyStore>
): string {
  const name = options.getToolName?.(eventType) ?? eventType;
  const normalizedName = name.replace(/[^a-zA-Z0-9_.-]/g, '_');
  return options.prefix
    ? `${options.prefix}.${normalizedName}`
    : normalizedName;
}

function assertValidToolName(name: string): void {
  if (!/^[a-zA-Z0-9_.-]{1,128}$/.test(name)) {
    throw new Error(
      `Invalid WebMCP tool name "${name}". Names must be 1-128 ASCII characters made of letters, numbers, "_", "-", or ".".`
    );
  }
}

async function validateInput(
  schema: StandardSchemaV1,
  eventType: string,
  input: unknown
): Promise<Record<string, unknown>> {
  const result = schema['~standard'].validate(input);
  const validated = isPromiseLike(result) ? await result : result;

  if (validated.issues) {
    throw new WebMCPInputError({
      eventType,
      issues: validated.issues
    });
  }

  if (
    !validated.value ||
    typeof validated.value !== 'object' ||
    Array.isArray(validated.value)
  ) {
    throw new WebMCPInputError({ eventType });
  }

  return validated.value as Record<string, unknown>;
}

function createTools<TStore extends AnyStore>(
  store: TStore,
  options: WebMCPAttachOptions<TStore>
): WebMCPTool[] {
  const eventSchemas = store.schemas?.events as
    | Record<string, StandardSchemaV1>
    | undefined;
  const schemas = eventSchemas ?? {};
  const eventTypes = resolveEventTypes(Object.keys(schemas), options.events);
  const tools: WebMCPTool[] = [];
  const names = new Set<string>();

  for (const eventType of eventTypes) {
    const schema = schemas[eventType];
    const inputSchema = getInputSchema(schema, options.toJSONSchema);
    const description = inputSchema.description;

    if (typeof description !== 'string' || !description.trim()) {
      throw new Error(
        `WebMCP event schema "${eventType}" must have a non-empty description.`
      );
    }

    const name = getToolName(eventType, options);
    assertValidToolName(name);

    if (names.has(name)) {
      throw new Error(`Duplicate WebMCP tool name "${name}".`);
    }

    names.add(name);
    tools.push({
      name,
      ...(typeof inputSchema.title === 'string'
        ? { title: inputSchema.title }
        : {}),
      description,
      inputSchema,
      async execute(input) {
        const payload = await validateInput(schema, eventType, input);
        store.send({ ...payload, type: eventType } as never);
        return { ok: true };
      }
    });
  }

  return tools;
}

/** Attaches browser-managed WebMCP tools derived from store event schemas. */
export function attachWebMCP<TStore extends AnyStore>(
  store: TStore,
  options: WebMCPAttachOptions<TStore>
): WebMCPAttachment {
  const tools = createTools(store, options);
  let controller: AbortController | undefined;
  let ready = Promise.resolve();
  let status: WebMCPStatus = 'idle';
  let error: unknown;

  return {
    get error() {
      return error;
    },
    get status() {
      return status;
    },
    tools,
    start() {
      if (controller) {
        return ready;
      }

      const modelContext = options.modelContext ?? getDocumentModelContext();

      if (!modelContext) {
        status = 'unsupported';
        return ready;
      }

      controller = new AbortController();
      const activeController = controller;
      status = 'registering';
      error = undefined;
      ready = Promise.all(
        tools.map((tool) =>
          Promise.resolve().then(() =>
            modelContext.registerTool(tool, {
              signal: activeController.signal
            })
          )
        )
      ).then(
        () => {
          if (controller === activeController) {
            status = 'ready';
          }
        },
        (registrationError) => {
          if (controller === activeController) {
            status = 'error';
            error = registrationError;
          }
        }
      );

      return ready;
    },
    stop() {
      controller?.abort();
      controller = undefined;
      status = 'idle';
      error = undefined;
    }
  };
}
