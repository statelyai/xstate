/**
 * A tiny fake of the Playwright `Page` API backed by an in-memory "app": a
 * counter whose increments land immediately, or after the clock advances when a
 * latency is configured.
 */
export interface FakeApp {
  count: number;
  label: string;
}

export interface FakePageOptions {
  /** Adds a bug: every increment adds one extra. */
  readonly broken?: boolean;
  /** Milliseconds before a pending increment lands. */
  readonly latency?: number;
}

export class FakePage {
  public readonly app: FakeApp = { count: 0, label: 'idle' };
  public readonly screenshots: string[] = [];
  /** Every `route()` call, in order. */
  public readonly routes: string[] = [];
  /** The route handlers currently installed, as Playwright would hold them. */
  public readonly installedRoutes: { url: string; handler: unknown }[] = [];
  /** Every `route()` and `unroute()` call, in order, as `"route <url>"` or `"unroute <url>"`. */
  public readonly routeLog: string[] = [];
  /** When set, `unroute()` rejects with this error. */
  public unrouteError: Error | undefined;
  public readonly loadStates: string[] = [];
  /** Every `tracing.start()` and `tracing.stop()` call, in order. */
  public readonly tracingLog: string[] = [];
  /** Scripts passed to `addInitScript()`. */
  public readonly initScripts: string[] = [];
  /** The requests `route()` handlers were called with. */
  public readonly routedRequests: object[] = [];
  private readonly listeners = new Map<string, Set<(payload: any) => void>>();
  private pending: { remaining: number; amount: number }[] = [];
  private failRequests = false;
  private shots = 0;

  public constructor(private readonly options: FakePageOptions = {}) {}

  public readonly clock = {
    runFor: (ticks: number): Promise<void> => {
      this.pending = this.pending.filter((entry) => {
        entry.remaining -= ticks;
        if (entry.remaining > 0) {
          return true;
        }
        this.apply(entry.amount);
        return false;
      });
      return Promise.resolve();
    }
  };

  public click(selector: string): Promise<void> {
    if (selector === '#inc') {
      this.enqueue(1);
    } else if (selector === '#reset') {
      this.app.count = 0;
      this.app.label = 'idle';
      this.pending = [];
    } else {
      throw new Error(`Unknown selector ${selector}`);
    }
    return Promise.resolve();
  }

  public fill(selector: string, value: string): Promise<void> {
    if (selector !== '#amount') {
      throw new Error(`Unknown selector ${selector}`);
    }
    this.enqueue(Number(value));
    return Promise.resolve();
  }

  public locator(selector: string) {
    return {
      textContent: (): Promise<string | null> => {
        if (selector === '#count') {
          return Promise.resolve(String(this.app.count));
        }
        if (selector === '#label') {
          return Promise.resolve(this.app.label);
        }
        return Promise.resolve(null);
      }
    };
  }

  public waitForLoadState(state = 'load'): Promise<void> {
    this.loadStates.push(state);
    return Promise.resolve();
  }

  /** Writes `options.path`, or returns the image as a buffer without one. */
  public screenshot(options?: { path?: string }): Promise<Buffer | undefined> {
    if (options?.path) {
      this.screenshots.push(options.path);
      return Promise.resolve(undefined);
    }
    return Promise.resolve(
      Buffer.from(`shot-${this.shots++}:${this.app.count}`)
    );
  }

  public context() {
    return {
      tracing: {
        start: (options?: object): Promise<void> => {
          this.tracingLog.push(`start ${JSON.stringify(options)}`);
          return Promise.resolve();
        },
        stop: (options?: { path?: string }): Promise<void> => {
          this.tracingLog.push(`stop ${options?.path ?? '(discarded)'}`);
          return Promise.resolve();
        }
      }
    };
  }

  public addInitScript(script: string): Promise<void> {
    this.initScripts.push(script);
    return Promise.resolve();
  }

  public on(event: string, listener: (payload: any) => void): this {
    const set = this.listeners.get(event) ?? new Set();
    set.add(listener);
    this.listeners.set(event, set);
    return this;
  }

  public off(event: string, listener: (payload: any) => void): this {
    this.listeners.get(event)?.delete(listener);
    return this;
  }

  /** The number of listeners registered for `event`. */
  public listenerCount(event: string): number {
    return this.listeners.get(event)?.size ?? 0;
  }

  public emit(event: string, payload: unknown): void {
    for (const listener of this.listeners.get(event) ?? []) {
      listener(payload);
    }
  }

  /** Emits a `console` event of the given type. */
  public emitConsole(type: string, text: string): void {
    this.emit('console', { type: () => type, text: () => text });
  }

  /** Emits a `response` event for `request`, or for a fresh request. */
  public emitResponse(
    status: number,
    url: string,
    request: object = { method: () => 'GET' }
  ): void {
    this.emit('response', {
      status: () => status,
      url: () => url,
      request: () => request
    });
  }

  public route(
    url: string,
    handler: (route: {
      fulfill: (response: unknown) => void;
      request: () => object;
    }) => void
  ): Promise<void> {
    this.routes.push(url);
    this.routeLog.push(`route ${url}`);
    this.installedRoutes.push({ url, handler });
    const request = { method: () => 'POST' };
    this.routedRequests.push(request);
    handler({
      request: () => request,
      fulfill: (response) => {
        this.failRequests = (response as { status?: number }).status === 500;
      }
    });
    return Promise.resolve();
  }

  public unroute(url: string, handler?: unknown): Promise<void> {
    this.routeLog.push(`unroute ${url}`);
    if (this.unrouteError) {
      return Promise.reject(this.unrouteError);
    }
    const index = this.installedRoutes.findIndex(
      (entry) =>
        entry.url === url &&
        (handler === undefined || entry.handler === handler)
    );
    if (index !== -1) {
      this.installedRoutes.splice(index, 1);
    }
    return Promise.resolve();
  }

  private enqueue(amount: number) {
    const latency = this.options.latency ?? 0;
    if (latency > 0) {
      this.pending.push({ remaining: latency, amount });
      return;
    }
    this.apply(amount);
  }

  private apply(amount: number) {
    if (this.failRequests) {
      this.app.label = 'error';
      return;
    }
    this.app.count += this.options.broken ? amount + 1 : amount;
    this.app.label = 'ok';
  }
}

/** Records what `createPlaywrightSut()` attaches, like Playwright's `testInfo`. */
export class FakeTestInfo {
  public readonly attachments: {
    name: string;
    body?: string | Uint8Array;
    path?: string;
    contentType?: string;
  }[] = [];

  public attach(
    name: string,
    options: { body?: string | Uint8Array; path?: string; contentType?: string }
  ): Promise<void> {
    this.attachments.push({ name, ...options });
    return Promise.resolve();
  }

  public outputPath(...segments: string[]): string {
    return ['test-results', ...segments].join('/');
  }
}
