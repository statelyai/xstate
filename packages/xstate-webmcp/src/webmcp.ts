import {
  type EventDescriptor,
  isWildcard,
  matchesEventDescriptor,
  resolveEventTypes
} from './descriptors.ts';
import {
  getInputJSONSchema,
  type JSONSchema,
  type StandardSchemaV1,
  validateEventPayload,
  validateInput
} from './schema.ts';

/** Hints that describe a tool's behavior to the agent. */
export interface WebMCPToolAnnotations {
  /** The tool does not change state. */
  readOnlyHint?: boolean;
  /** The tool returns content the page does not control. */
  untrustedContentHint?: boolean;
  /** The tool has consequences the user may want to confirm. */
  consequentialHint?: boolean;
  /** The tool is for debugging only. */
  debugging?: boolean;
}

export interface WebMCPToolExecuteOptions {
  signal?: AbortSignal;
}

/** A tool in the shape `document.modelContext.registerTool(...)` accepts. */
export interface WebMCPTool {
  name: string;
  title?: string;
  description: string;
  inputSchema: JSONSchema;
  annotations?: WebMCPToolAnnotations;
  execute: (
    input: Record<string, unknown>,
    options?: WebMCPToolExecuteOptions
  ) => Promise<unknown>;
}

export interface WebMCPRegisterToolOptions {
  signal?: AbortSignal;
  exposedTo?: string[];
}

/** The subset of the WebMCP `ModelContext` interface that tools register with. */
export interface WebMCPModelContext {
  registerTool(
    tool: WebMCPTool,
    options?: WebMCPRegisterToolOptions
  ): Promise<void> | void;
}

interface TargetSubscription {
  unsubscribe(): void;
}

/**
 * Anything that can receive events and report snapshots: an XState actor or an
 * `@xstate/store` store.
 */
export interface WebMCPTarget {
  send: (event: any) => void;
  getSnapshot: () => any;
  subscribe: (
    next: (snapshot: any) => void,
    error?: (error: any) => void,
    complete?: () => void
  ) => TargetSubscription;
}

type EventOf<TTarget extends WebMCPTarget> = Extract<
  Parameters<TTarget['send']>[0],
  { type: string }
>;

/** Event types of `TTarget` that can be exposed as tools. */
export type WebMCPEventType<TTarget extends WebMCPTarget> = Exclude<
  EventOf<TTarget>['type'],
  `xstate.${string}`
>;

type SnapshotOf<TTarget extends WebMCPTarget> = ReturnType<
  TTarget['getSnapshot']
>;

export interface WebMCPWaitForOptions {
  /** Rejects when aborted. Defaults to the tool call's signal. */
  signal?: AbortSignal;
  /** Rejects after this many milliseconds. */
  timeout?: number;
}

/** Passed to the `execute` function of a custom tool. */
export interface WebMCPToolContext<TTarget extends WebMCPTarget> {
  /** The actor or store the tools were created for. */
  target: TTarget;
  send: (event: EventOf<TTarget>) => void;
  getSnapshot: () => SnapshotOf<TTarget>;
  /**
   * Resolves with the first snapshot (including the current one) that satisfies
   * `predicate`. Rejects if the target errors, finishes or stops first.
   */
  waitFor: (
    predicate: (snapshot: SnapshotOf<TTarget>) => boolean,
    options?: WebMCPWaitForOptions
  ) => Promise<SnapshotOf<TTarget>>;
  /** Aborted when the agent cancels the tool call. */
  signal: AbortSignal;
}

type ToolInput<TInput extends StandardSchemaV1 | undefined> =
  TInput extends StandardSchemaV1
    ? StandardSchemaV1.InferOutput<TInput>
    : Record<string, never>;

export interface WebMCPToolConfig<
  TTarget extends WebMCPTarget,
  TInput extends StandardSchemaV1 | undefined,
  TResult
> {
  title?: string;
  description: string;
  /** Validates the tool input. Also converted to the tool's input JSON Schema. */
  input?: TInput;
  annotations?: WebMCPToolAnnotations;
  execute: (
    input: ToolInput<TInput>,
    context: WebMCPToolContext<TTarget>
  ) => TResult | Promise<TResult>;
}

declare const toolDefinitionBrand: unique symbol;

/** A custom tool created with the `tool` helper. */
export interface WebMCPToolDefinition {
  readonly [toolDefinitionBrand]: true;
}

export interface WebMCPToolHelpers<TTarget extends WebMCPTarget> {
  tool: <
    TInput extends StandardSchemaV1 | undefined = undefined,
    TResult = unknown
  >(
    config: WebMCPToolConfig<TTarget, TInput, TResult>
  ) => WebMCPToolDefinition;
}

export interface WebMCPEventToolOverride {
  /** Tool name before the prefix is applied, used as written. */
  name?: string;
  title?: string;
  /** Defaults to the event schema's description. */
  description?: string;
  annotations?: WebMCPToolAnnotations;
}

export interface WebMCPStateToolOptions {
  /** Tool name before the prefix is applied. Defaults to `get_state`. */
  name?: string;
  title?: string;
  description?: string;
}

export interface WebMCPOptions<TTarget extends WebMCPTarget> {
  /**
   * Events to expose as tools: exact event types, `'*'`, or trailing-token
   * wildcards such as `'todo.*'`. Each exposed event needs an event schema.
   */
  events:
    | EventDescriptor<WebMCPEventType<TTarget>>
    | readonly EventDescriptor<WebMCPEventType<TTarget>>[];
  /**
   * Maps an event type and its event schema to the tool name. Defaults to
   * `toToolName`, which turns `'checkout.confirm'` into `'checkout_confirm'`.
   */
  toolName?: (
    eventType: WebMCPEventType<TTarget>,
    schema: StandardSchemaV1
  ) => string;
  /** Prepended to every tool name as `${prefix}_${name}`. */
  prefix?: string;
  /** Per-event tool names, descriptions and annotations. */
  overrides?: { [K in WebMCPEventType<TTarget>]?: WebMCPEventToolOverride };
  /**
   * Converts a snapshot to the value that event tools and the state tool
   * return. Defaults to `{ status, state, output }` (no context).
   */
  output?: (snapshot: SnapshotOf<TTarget>) => unknown;
  /**
   * For machine actors, `'state'` (default) registers an event tool only while
   * the current state handles that event. `'always'` keeps every event tool
   * registered. Has no effect on stores.
   */
  availability?: 'state' | 'always';
  /** Adds a read-only tool that returns `output(snapshot)`. Defaults to `true`. */
  stateTool?: boolean | WebMCPStateToolOptions;
  /** Custom tools, keyed by tool name. */
  tools?: (
    helpers: WebMCPToolHelpers<TTarget>
  ) => Record<string, WebMCPToolDefinition>;
  /** Converts schemas that do not implement Standard JSON Schema. */
  toJSONSchema?: (schema: StandardSchemaV1) => JSONSchema;
}

export interface WebMCPRegisterOptions {
  /** Defaults to `document.modelContext`, then `navigator.modelContext`. */
  modelContext?: WebMCPModelContext;
  /** Unregisters every tool when aborted. */
  signal?: AbortSignal;
  /** Origins the tools are exposed to. */
  exposedTo?: string[];
  /**
   * Called when registering a tool fails after `ready` has settled. Defaults to
   * `reportError`.
   */
  onError?: (error: unknown, tool: WebMCPTool) => void;
}

export type WebMCPRegistrationStatus =
  | 'registered'
  | 'unregistered'
  | 'unsupported';

export interface WebMCPRegistration {
  /** `'unsupported'` when no model context is available. */
  readonly status: WebMCPRegistrationStatus;
  /** Settles when the initially available tools have registered. */
  readonly ready: Promise<void>;
  /** Unregisters every tool and stops tracking state. */
  unregister(): void;
}

export interface WebMCP {
  /** Every tool, including event tools unavailable in the current state. */
  readonly tools: readonly WebMCPTool[];
  /** Tools available in the current state. */
  getAvailableTools(): WebMCPTool[];
  /** Registers the available tools with the browser's model context. */
  register(options?: WebMCPRegisterOptions): WebMCPRegistration;
}

interface ToolEntry {
  tool: WebMCPTool;
  eventType?: string;
}

interface MachineSnapshotLike {
  status: string;
  nodes: Array<{ ownEvents: string[] }>;
  can(event: { type: string }): boolean;
}

interface MachineLike {
  idMap: Map<
    string,
    { transitions: Map<string, Array<{ description?: string }>> }
  >;
}

const EMPTY_INPUT_SCHEMA: JSONSchema = { type: 'object', properties: {} };

function isMachineSnapshot(snapshot: unknown): snapshot is MachineSnapshotLike {
  return (
    !!snapshot &&
    Array.isArray((snapshot as MachineSnapshotLike).nodes) &&
    typeof (snapshot as MachineSnapshotLike).can === 'function'
  );
}

function getEventSchemas(
  target: WebMCPTarget
): Record<string, StandardSchemaV1> {
  const source = target as {
    schemas?: { events?: Record<string, StandardSchemaV1> };
    logic?: { schemas?: { events?: Record<string, StandardSchemaV1> } };
  };
  return source.schemas?.events ?? source.logic?.schemas?.events ?? {};
}

function getTransitionDescription(
  target: WebMCPTarget,
  eventType: string
): string | undefined {
  const machine = (target as { logic?: Partial<MachineLike> }).logic;

  if (!(machine?.idMap instanceof Map)) {
    return undefined;
  }

  // Exact transitions first, then matching wildcards, most specific first.
  const candidates: Array<{ rank: number; description: string }> = [];

  for (const node of machine.idMap.values()) {
    for (const [descriptor, transitions] of node.transitions ?? []) {
      const description = transitions.find(
        (transition) => transition.description
      )?.description;

      if (description && matchesEventDescriptor(eventType, descriptor)) {
        candidates.push({
          rank: descriptor === eventType ? Infinity : descriptor.length,
          description
        });
      }
    }
  }

  return candidates.sort((a, b) => b.rank - a.rank)[0]?.description;
}

function defaultOutput(snapshot: {
  status?: unknown;
  value?: unknown;
  output?: unknown;
}): Record<string, unknown> {
  return {
    status: snapshot.status,
    ...(snapshot.value !== undefined ? { state: snapshot.value } : {}),
    ...(snapshot.output !== undefined ? { output: snapshot.output } : {})
  };
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function getDefaultModelContext(): WebMCPModelContext | undefined {
  const global = globalThis as {
    document?: { modelContext?: WebMCPModelContext };
    navigator?: { modelContext?: WebMCPModelContext };
  };

  return global.document?.modelContext ?? global.navigator?.modelContext;
}

function defaultOnError(error: unknown): void {
  const report = (globalThis as { reportError?: (error: unknown) => void })
    .reportError;

  if (report) {
    report(error);
  } else {
    console.error(error);
  }
}

function waitForSnapshot<TSnapshot>(
  target: WebMCPTarget,
  predicate: (snapshot: TSnapshot) => boolean,
  options: WebMCPWaitForOptions
): Promise<TSnapshot> {
  return new Promise((resolve, reject) => {
    const { signal, timeout } = options;

    if (signal?.aborted) {
      reject(toError(signal.reason));
      return;
    }

    let done = false;
    // Assigned after `finish` is defined, which may run during `subscribe`.
    const subscriptionRef: { current?: TargetSubscription } = {};
    let timer: ReturnType<typeof setTimeout> | undefined;

    const finish = (settle: () => void) => {
      if (done) {
        return;
      }
      done = true;
      subscriptionRef.current?.unsubscribe();
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      settle();
    };

    const check = (
      snapshot: TSnapshot & { status?: string; error?: unknown }
    ) => {
      let matches: boolean;
      try {
        matches = predicate(snapshot);
      } catch (error) {
        finish(() => reject(toError(error)));
        return;
      }

      if (matches) {
        finish(() => resolve(snapshot));
      } else if (snapshot.status === 'error') {
        finish(() => reject(toError(snapshot.error)));
      } else if (snapshot.status === 'done' || snapshot.status === 'stopped') {
        finish(() =>
          reject(
            new Error(
              `The target reached status "${snapshot.status}" before the condition was met.`
            )
          )
        );
      }
    };

    const onAbort = () => finish(() => reject(toError(signal!.reason)));

    signal?.addEventListener('abort', onAbort, { once: true });

    if (timeout !== undefined) {
      timer = setTimeout(
        () =>
          finish(() =>
            reject(new Error(`waitFor timed out after ${timeout}ms.`))
          ),
        timeout
      );
    }

    const subscription = target.subscribe(
      (snapshot) => check(snapshot),
      (error) => finish(() => reject(toError(error))),
      // A stopped actor completes without publishing its final snapshot.
      () => {
        check(target.getSnapshot());
        finish(() =>
          reject(new Error('The target stopped before the condition was met.'))
        );
      }
    );
    subscriptionRef.current = subscription;

    if (done) {
      subscription.unsubscribe();
    } else {
      check(target.getSnapshot());
    }
  });
}

/**
 * Converts an event type to a tool name by replacing `.` and other characters
 * outside `[a-zA-Z0-9_-]` with `_`: `'checkout.confirm'` becomes
 * `'checkout_confirm'`. Model APIs that agents forward tools to commonly reject
 * other characters in tool names.
 */
export function toToolName(eventType: string): string {
  return eventType.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function assertValidToolName(name: string): void {
  if (!/^[a-zA-Z0-9_.-]{1,128}$/.test(name)) {
    throw new Error(
      `Invalid tool name "${name}". Names must be 1-128 characters made of ASCII letters, digits, "_", "-" or ".".`
    );
  }
}

/**
 * Creates WebMCP tools from an XState actor or an `@xstate/store` store. Each
 * exposed event becomes a tool whose input is the event payload; custom tools
 * can send several events and wait for results.
 *
 * @example
 *
 * ```ts
 * const webMCP = createWebMCP(store, { events: ['todo.*'] });
 * const registration = webMCP.register();
 * // later
 * registration.unregister();
 * ```
 */
export function createWebMCP<TTarget extends WebMCPTarget>(
  target: TTarget,
  options: WebMCPOptions<TTarget>
): WebMCP {
  const schemas = getEventSchemas(target);
  const descriptors: readonly string[] =
    typeof options.events === 'string' ? [options.events] : options.events;
  const eventTypes = resolveEventTypes(
    Object.keys(schemas).filter((eventType) => !isWildcard(eventType)),
    descriptors
  );
  const tracksState =
    (options.availability ?? 'state') === 'state' &&
    isMachineSnapshot(target.getSnapshot());
  const output = (options.output ?? defaultOutput) as (
    snapshot: unknown
  ) => unknown;
  const overrides = (options.overrides ?? {}) as Record<
    string,
    WebMCPEventToolOverride | undefined
  >;
  const names = new Map<string, string>();
  const mapToolName = (options.toolName ?? toToolName) as (
    eventType: string,
    schema: StandardSchemaV1
  ) => string;
  const entries: ToolEntry[] = [];

  const toolName = (name: string, source: string): string => {
    const fullName = options.prefix ? `${options.prefix}_${name}` : name;
    assertValidToolName(fullName);

    const existing = names.get(fullName);
    if (existing) {
      throw new Error(
        `Duplicate tool name "${fullName}" for ${existing} and ${source}.`
      );
    }

    names.set(fullName, source);
    return fullName;
  };

  const handles = (entry: ToolEntry, snapshot: unknown): boolean =>
    !entry.eventType ||
    !isMachineSnapshot(snapshot) ||
    (snapshot.status === 'active' &&
      snapshot.nodes.some((node) =>
        node.ownEvents.some((descriptor) =>
          matchesEventDescriptor(entry.eventType!, descriptor)
        )
      ));

  const isAvailable = (entry: ToolEntry, snapshot: unknown): boolean =>
    !tracksState || handles(entry, snapshot);

  const getAvailableTools = (): WebMCPTool[] => {
    const snapshot = target.getSnapshot();
    return entries
      .filter((entry) => isAvailable(entry, snapshot))
      .map((entry) => entry.tool);
  };

  for (const eventType of eventTypes) {
    const schema = schemas[eventType];
    const override = overrides[eventType] ?? {};
    const inputSchema = getInputJSONSchema(
      schema,
      options.toJSONSchema,
      `event "${eventType}"`
    );
    const schemaDescription =
      typeof inputSchema.description === 'string' &&
      inputSchema.description.trim()
        ? inputSchema.description
        : undefined;
    const description =
      override.description ??
      schemaDescription ??
      getTransitionDescription(target, eventType);

    if (!description) {
      throw new Error(
        `Event "${eventType}" needs a description to become a tool. Describe its schema (for example \`z.object({...}).describe('...')\`) or set \`overrides["${eventType}"].description\`.`
      );
    }

    const name = toolName(
      override.name ?? mapToolName(eventType, schema),
      `event "${eventType}"`
    );
    const title =
      override.title ??
      (typeof inputSchema.title === 'string' ? inputSchema.title : undefined);

    entries.push({
      eventType,
      tool: {
        name,
        ...(title ? { title } : {}),
        description,
        inputSchema,
        ...(override.annotations ? { annotations: override.annotations } : {}),
        async execute(input, executeOptions) {
          const signal = executeOptions?.signal;
          signal?.throwIfAborted();
          const payload = await validateEventPayload(schema, name, input);
          signal?.throwIfAborted();
          const event = { ...payload, type: eventType };
          const snapshot = target.getSnapshot();

          if (isMachineSnapshot(snapshot) && !snapshot.can(event)) {
            const available = entries
              .filter((entry) => handles(entry, snapshot))
              .map((entry) => entry.tool.name);
            throw new Error(
              `Tool "${name}" cannot run in the current state. Available tools: ${
                available.length ? available.join(', ') : 'none'
              }.`
            );
          }

          target.send(event);
          const next = target.getSnapshot();

          if (next?.status === 'error') {
            throw toError(next.error);
          }

          return output(next);
        }
      }
    });
  }

  if (options.stateTool !== false) {
    const stateTool =
      typeof options.stateTool === 'object' ? options.stateTool : {};
    entries.push({
      tool: {
        name: toolName(stateTool.name ?? 'get_state', 'the state tool'),
        ...(stateTool.title ? { title: stateTool.title } : {}),
        description: stateTool.description ?? 'Get the current state.',
        inputSchema: EMPTY_INPUT_SCHEMA,
        annotations: { readOnlyHint: true },
        execute() {
          return Promise.resolve(output(target.getSnapshot()));
        }
      }
    });
  }

  const configs = new WeakMap<
    WebMCPToolDefinition,
    WebMCPToolConfig<TTarget, StandardSchemaV1 | undefined, unknown>
  >();
  const helpers: WebMCPToolHelpers<TTarget> = {
    tool: (config) => {
      const definition = {} as WebMCPToolDefinition;
      configs.set(definition, config as never);
      return definition;
    }
  };

  for (const [key, definition] of Object.entries(
    options.tools?.(helpers) ?? {}
  )) {
    const config = configs.get(definition);

    if (!config) {
      throw new Error(
        `Custom tool "${key}" must be created with the \`tool\` helper.`
      );
    }

    const name = toolName(key, `custom tool "${key}"`);
    const inputSchema = config.input
      ? getInputJSONSchema(config.input, options.toJSONSchema, `tool "${key}"`)
      : EMPTY_INPUT_SCHEMA;

    entries.push({
      tool: {
        name,
        ...(config.title ? { title: config.title } : {}),
        description: config.description,
        inputSchema,
        ...(config.annotations ? { annotations: config.annotations } : {}),
        async execute(input, executeOptions) {
          const signal = executeOptions?.signal ?? new AbortController().signal;
          signal.throwIfAborted();
          const value = await validateInput(config.input, name, input);
          signal.throwIfAborted();

          return config.execute(value as never, {
            target,
            send: (event) => target.send(event),
            getSnapshot: () => target.getSnapshot(),
            waitFor: (predicate, waitOptions = {}) =>
              waitForSnapshot(target, predicate, {
                signal,
                ...waitOptions
              }),
            signal
          });
        }
      }
    });
  }

  return {
    tools: entries.map((entry) => entry.tool),
    getAvailableTools,
    register(registerOptions = {}) {
      const modelContext =
        registerOptions.modelContext ?? getDefaultModelContext();

      if (!modelContext) {
        return {
          status: 'unsupported',
          ready: Promise.resolve(),
          unregister() {}
        };
      }

      const { signal, exposedTo } = registerOptions;
      const onError = registerOptions.onError ?? defaultOnError;
      const controllers = new Map<WebMCPTool, AbortController>();
      let status: WebMCPRegistrationStatus = 'registered';
      let subscription: TargetSubscription | undefined;

      const registerTool = (tool: WebMCPTool): Promise<void> => {
        const controller = new AbortController();
        controllers.set(tool, controller);

        return Promise.resolve()
          .then(() => {
            // A state change or `unregister()` superseded this registration.
            if (!controller.signal.aborted) {
              return modelContext.registerTool(tool, {
                signal: controller.signal,
                ...(exposedTo ? { exposedTo } : {})
              });
            }
          })
          .catch((error: unknown) => {
            if (controller.signal.aborted) {
              return;
            }
            if (controllers.get(tool) === controller) {
              controllers.delete(tool);
            }
            throw error;
          });
      };

      const sync = (snapshot: unknown) => {
        if (status !== 'registered') {
          return;
        }

        for (const entry of entries) {
          const controller = controllers.get(entry.tool);
          const available = isAvailable(entry, snapshot);

          if (available && !controller) {
            registerTool(entry.tool).catch((error) =>
              onError(error, entry.tool)
            );
          } else if (!available && controller) {
            controller.abort();
            controllers.delete(entry.tool);
          }
        }
      };

      const unregister = () => {
        if (status !== 'registered') {
          return;
        }

        status = 'unregistered';
        subscription?.unsubscribe();
        signal?.removeEventListener('abort', unregister);

        for (const controller of controllers.values()) {
          controller.abort();
        }

        controllers.clear();
      };

      if (signal?.aborted) {
        status = 'unregistered';
        return { status, ready: Promise.resolve(), unregister() {} };
      }

      signal?.addEventListener('abort', unregister, { once: true });

      // Registration is all or nothing: if a tool fails to register, remove
      // the others so a retry does not collide with them.
      const ready = Promise.all(getAvailableTools().map(registerTool)).then(
        () => {},
        (error: unknown) => {
          unregister();
          throw error;
        }
      );

      if (tracksState) {
        const syncCurrent = () => sync(target.getSnapshot());
        subscription = target.subscribe(sync, syncCurrent, syncCurrent);
      }

      return {
        get status() {
          return status;
        },
        ready,
        unregister
      };
    }
  };
}
