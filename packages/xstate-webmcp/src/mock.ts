import type {
  WebMCPModelContext,
  WebMCPRegisterToolOptions,
  WebMCPTool
} from './webmcp.ts';

export interface MockModelContext extends WebMCPModelContext {
  /** Currently registered tools, keyed by name. */
  readonly tools: ReadonlyMap<string, WebMCPTool>;
  /** Names of the currently registered tools, in registration order. */
  getToolNames(): string[];
  /**
   * Runs a registered tool and returns its result after a JSON round trip, the
   * way a browser serializes tool results.
   */
  executeTool(
    name: string,
    input?: Record<string, unknown>,
    options?: { signal?: AbortSignal }
  ): Promise<unknown>;
}

/**
 * Creates an in-memory model context for tests. It follows the WebMCP
 * registration rules: duplicate names reject, and aborting the registration
 * signal unregisters the tool.
 */
export function createMockModelContext(): MockModelContext {
  const tools = new Map<string, WebMCPTool>();

  return {
    tools,
    registerTool(tool: WebMCPTool, options?: WebMCPRegisterToolOptions) {
      // Like the browser, reject registration with an already-aborted signal.
      if (options?.signal?.aborted) {
        const reason: unknown = options.signal.reason;
        return Promise.reject(
          reason instanceof Error ? reason : new Error(String(reason))
        );
      }

      if (tools.has(tool.name)) {
        return Promise.reject(
          new Error(`A tool named "${tool.name}" is already registered.`)
        );
      }

      tools.set(tool.name, tool);
      options?.signal?.addEventListener(
        'abort',
        () => {
          if (tools.get(tool.name) === tool) {
            tools.delete(tool.name);
          }
        },
        { once: true }
      );
      return Promise.resolve();
    },
    getToolNames() {
      return [...tools.keys()];
    },
    async executeTool(name, input = {}, options = {}) {
      const tool = tools.get(name);

      if (!tool) {
        throw new Error(`No tool named "${name}" is registered.`);
      }

      const result = await tool.execute(input, {
        signal: options.signal ?? new AbortController().signal
      });
      const serialized = JSON.stringify(result);

      return serialized === undefined ? undefined : JSON.parse(serialized);
    }
  };
}
