import type { EventObject, Snapshot } from 'xstate';
import type {
  TestFixture,
  TestStateAssertions,
  TestSut,
  TestSutCompleteContext,
  TestSutContext,
  TestSutDisposeContext,
  TestSutSendContext,
  TestSutSession
} from 'xstate/graph';

/**
 * The subset of the Playwright `Page` API this package uses.
 *
 * A real `Page` from `playwright` or `@playwright/test` is assignable to this
 * type, so no Playwright import is needed at runtime or at type-check time.
 * Everything is optional because only the parts your configuration reaches for
 * are used.
 */
export interface PlaywrightPage {
  readonly waitForLoadState?: (state?: any, options?: any) => Promise<void>;
  readonly screenshot?: (options?: any) => Promise<any>;
  readonly route?: (url: any, handler: any, options?: any) => Promise<unknown>;
  readonly unroute?: (url: any, handler?: any) => Promise<void>;
  readonly clock?: {
    readonly runFor?: (ticks: any) => Promise<void>;
  };
  readonly context?: () => {
    readonly tracing?: {
      readonly start?: (options?: any) => Promise<void>;
      readonly stop?: (options?: any) => Promise<void>;
    };
  };
  readonly on?: (event: any, listener: any) => unknown;
  readonly off?: (event: any, listener: any) => unknown;
  readonly addInitScript?: (script: any, arg?: any) => Promise<unknown>;
}

/**
 * The subset of Playwright's `TestInfo` this package uses. The `testInfo`
 * fixture of `@playwright/test` is assignable to it.
 */
export interface PlaywrightTestInfo {
  readonly attach: (
    name: string,
    options: {
      /** A string or a `Buffer`. */
      readonly body?: any;
      readonly path?: string;
      readonly contentType?: string;
    }
  ) => Promise<void>;
  readonly outputPath: (...pathSegments: string[]) => string;
}

/**
 * The page-level oracles `createPlaywrightSut()` checks after every stable
 * step. Keys left out are off.
 */
export interface PlaywrightOracles {
  /** Fails on uncaught exceptions in the page (`pageerror`). */
  readonly pageError?: boolean;
  /** Fails on console messages of this level or above. */
  readonly console?: 'error' | 'warn' | false;
  /**
   * Fails on responses with at least this status code. Responses to requests
   * a `mocks` route handled are ignored.
   */
  readonly http?: number | false;
  /** Fails on unhandled promise rejections in the page. */
  readonly unhandledRejection?: boolean;
}

/** Thrown by a session's `check()` when a page-level oracle fails. */
export class PlaywrightOracleError extends Error {
  public override readonly name = 'PlaywrightOracleError';

  public constructor(public readonly messages: readonly string[]) {
    super(
      `The page reported ${messages.length} error${
        messages.length === 1 ? '' : 's'
      }:\n${messages.map((message) => `  - ${message}`).join('\n')}`,
      { cause: messages }
    );
  }
}

/** A Playwright action bound to a generated event. */
export type PlaywrightEventAction<
  TPage extends PlaywrightPage,
  TEvent extends EventObject
> = (page: TPage, event: TEvent) => void | Promise<void>;

/** Per-event-case network stubbing, applied before the event action runs. */
export type PlaywrightMock<TPage extends PlaywrightPage> = (
  page: TPage
) => void | Promise<unknown>;

export interface PlaywrightSutConfig<
  TPage extends PlaywrightPage,
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject
> {
  /** Performs each event against the page. */
  readonly events: {
    readonly [TType in TEvent['type']]?: PlaywrightEventAction<
      TPage,
      TEvent extends { type: TType } ? TEvent : never
    >;
  };
  /**
   * Projects the DOM to a value comparable with the model projection. Omit it
   * (together with `projectModel`) to assert through `states` instead.
   */
  readonly read?: (page: TPage) => unknown | Promise<unknown>;
  /** Projects the model snapshot to a value comparable with the page projection. */
  readonly projectModel?: (snapshot: TSnapshot) => unknown;
  /**
   * Per-state assertions run after every stable step, keyed by state value (or
   * `'#id'`), with `'*'` as the fallthrough.
   */
  readonly states?: {
    readonly [stateKey: string]: (
      page: TPage,
      snapshot: TSnapshot
    ) => void | Promise<void>;
  };
  /** Normalizes the value read from the page before comparison. */
  readonly projectSut?: (observed: unknown) => unknown;
  /** Compares model and page projections. Defaults to deep equality. */
  readonly equivalent?: (
    model: unknown,
    sut: unknown
  ) => boolean | Promise<boolean>;
  /**
   * Waits for the page to become quiescent before every comparison. Defaults to
   * `page.waitForLoadState('load')` followed by a microtask flush. Pass a
   * function to wait for something specific, such as a locator.
   */
  readonly settle?: (page: TPage) => void | Promise<void>;
  /**
   * Advances page time. Defaults to `page.clock.runFor(milliseconds)` when
   * Playwright's clock API is installed, and returns no events.
   */
  readonly advance?: (
    page: TPage,
    milliseconds: number
  ) => readonly TEvent[] | Promise<readonly TEvent[]>;
  /**
   * Records a checkpoint. Defaults to a screenshot written to the
   * configured screenshot directory.
   */
  readonly checkpoint?: (page: TPage, label: string) => void | Promise<void>;
  /** Directory for default checkpoint screenshots. */
  readonly screenshotDir?: string;
  /** Runs once when a scenario session is created. */
  readonly reset?: (page: TPage) => void | Promise<void>;
  /** Runs when a scenario stops. */
  readonly stop?: (page: TPage) => void | Promise<void>;
  /** Runs when a scenario session is disposed. */
  readonly dispose?: (page: TPage) => void | Promise<void>;
  /**
   * Per-case `page.route()` setup. When the property runner supplies the
   * generated event case, the key is looked up as `"<type>.<case>"` first and
   * then as `"<case>"`; otherwise (prefix, clock and replayed events) the key
   * is the case resolved by `caseOf`. Use it to steer an invoked service to
   * success or failure on different generated paths.
   *
   * Routes installed by a mock are unrouted before another case's mock is
   * applied and when the scenario session is disposed, so handlers do not
   * leak across cases or runs.
   */
  readonly mocks?: {
    readonly [caseId: string]: PlaywrightMock<TPage>;
  };
  /**
   * Resolves the mock case for an event. Defaults to `event.case` when present,
   * otherwise `event.type`.
   */
  readonly caseOf?: (event: TEvent) => string | undefined;
  /**
   * Page-level oracles checked after every stable step. `'defaults'` (the
   * default) fails on uncaught exceptions, console errors, unhandled
   * rejections, and responses with a status of 400 or above. `false` turns
   * them all off.
   */
  readonly oracles?: 'defaults' | false | PlaywrightOracles;
  /**
   * Where failure artifacts are attached. Pass Playwright's `testInfo`
   * fixture. Required when `trace` or `screenshots` is on.
   */
  readonly testInfo?: PlaywrightTestInfo;
  /**
   * Records a Playwright trace per run. `'retain-on-failure'` attaches the
   * trace of the failing run; `'on'` also attaches the last run's trace when
   * the campaign passes. Defaults to `'retain-on-failure'` with `testInfo`,
   * and `'off'` without.
   */
  readonly trace?: 'off' | 'retain-on-failure' | 'on';
  /**
   * `'on-failure'` attaches a screenshot of the page when the failing run
   * ends; `'every-step'` attaches one per stable step of the failing run.
   * Defaults to `'on-failure'` with `testInfo`, and `'off'` without.
   */
  readonly screenshots?: 'off' | 'on-failure' | 'every-step';
  /**
   * Wraps each event action, such as Playwright's `test.step`, so the report
   * shows one step per event.
   */
  readonly step?: (name: string, body: () => Promise<void>) => Promise<unknown>;
}

const DEFAULT_ORACLES: Required<PlaywrightOracles> = {
  pageError: true,
  console: 'error',
  http: 400,
  unhandledRejection: true
};

/** Marks the console messages the rejection listener writes. */
const REJECTION_PREFIX = '[xstate-test] unhandledrejection: ';

const REJECTION_SCRIPT = `window.addEventListener('unhandledrejection', function (event) {
  var reason = event.reason;
  console.error(${JSON.stringify(REJECTION_PREFIX)} + (reason && reason.message ? reason.message : String(reason)));
});`;

function resolveOracles(
  oracles: PlaywrightSutConfig<any, any, any>['oracles']
): Required<PlaywrightOracles> | undefined {
  if (oracles === false) {
    return undefined;
  }
  if (oracles === undefined || oracles === 'defaults') {
    return DEFAULT_ORACLES;
  }
  return {
    pageError: oracles.pageError ?? false,
    console: oracles.console ?? false,
    http: oracles.http ?? false,
    unhandledRejection: oracles.unhandledRejection ?? false
  };
}

function formatStepName(event: EventObject): string {
  const { type, ...payload } = event as EventObject & Record<string, unknown>;
  return Object.keys(payload).length
    ? `${type} ${JSON.stringify(payload)}`
    : type;
}

/** What the last failing session left behind, attached when the campaign ends. */
interface FailureArtifacts {
  readonly trace?: string;
  readonly screenshot?: Uint8Array;
  readonly steps: readonly Uint8Array[];
}

function defaultCaseOf(event: EventObject): string {
  const explicit = (event as { case?: unknown }).case;
  return typeof explicit === 'string' ? explicit : event.type;
}

type InstalledRoute = readonly unknown[];

/**
 * Wraps a page so every `route()` a mock installs is recorded and can be
 * removed again when another case's mock is applied or the session is disposed.
 */
function trackRoutes<TPage extends PlaywrightPage>(
  page: TPage,
  installed: InstalledRoute[],
  mockedRequests: WeakSet<object>
): TPage {
  if (typeof (page as { route?: unknown }).route !== 'function') {
    return page;
  }
  return new Proxy(page as object, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);
      if (typeof value !== 'function') {
        return value;
      }
      if (property === 'route') {
        return (url: unknown, handler: unknown, ...rest: unknown[]) => {
          // Requests a mock handles are exempt from the `http` oracle.
          const tracked =
            typeof handler === 'function'
              ? (route: { request?: () => unknown }, ...more: unknown[]) => {
                  const request = (more[0] ?? route?.request?.()) as unknown;
                  if (request && typeof request === 'object') {
                    mockedRequests.add(request);
                  }
                  return handler(route, ...more);
                }
              : handler;
          const args = [url, tracked, ...rest];
          installed.push(args);
          return value.apply(target, args);
        };
      }
      return value.bind(target);
    }
  }) as TPage;
}

/** Removes every route a mock installed through {@link trackRoutes}. */
async function releaseRoutes<TPage extends PlaywrightPage>(
  page: TPage,
  installed: InstalledRoute[]
): Promise<void> {
  const unroute = (page as { unroute?: (...args: unknown[]) => unknown })
    .unroute;
  if (typeof unroute === 'function') {
    for (const args of installed) {
      await unroute.call(page, args[0], args[1]);
    }
  }
  installed.length = 0;
}

/**
 * Resolves the mock for a generated event case, trying `"<type>.<case>"`, then
 * `"<case>"`, then the case resolved by `caseOf`.
 */
function resolveMock<TPage extends PlaywrightPage>(
  mocks: Record<string, PlaywrightMock<TPage> | undefined> | undefined,
  eventCase: { readonly type: string; readonly name: string } | undefined,
  fallbackCase: string | undefined
): { key: string; mock: PlaywrightMock<TPage> } | undefined {
  if (!mocks) {
    return undefined;
  }
  const keys = [
    ...(eventCase
      ? [`${eventCase.type}.${eventCase.name}`, eventCase.name]
      : []),
    ...(fallbackCase === undefined ? [] : [fallbackCase])
  ];
  for (const key of keys) {
    const mock = mocks[key];
    if (mock) {
      return { key, mock };
    }
  }
  return undefined;
}

function sanitizeLabel(label: string): string {
  return label.replace(/[^a-zA-Z0-9._-]+/g, '-');
}

/**
 * Creates a `TestSut` that drives a Playwright page as the system under
 * test for `propertyTest()` and `testPaths()`.
 */
export function createPlaywrightSut<
  TPage extends PlaywrightPage,
  TSnapshot extends Snapshot<unknown> = Snapshot<unknown>,
  TEvent extends EventObject = EventObject
>(
  page: TPage,
  config: PlaywrightSutConfig<TPage, TSnapshot, TEvent>
): TestSut<TSnapshot, TEvent> {
  const caseOf = config.caseOf ?? (defaultCaseOf as (event: TEvent) => string);
  const screenshotDir = config.screenshotDir ?? 'property-screenshots';
  const testInfo = config.testInfo;
  const trace = config.trace ?? (testInfo ? 'retain-on-failure' : 'off');
  const screenshots = config.screenshots ?? (testInfo ? 'on-failure' : 'off');
  if (!testInfo && (trace !== 'off' || screenshots !== 'off')) {
    throw new Error(
      "`trace` and `screenshots` attach their files to `testInfo`; pass Playwright's `testInfo` fixture to `createPlaywrightSut()`."
    );
  }
  const oracles = resolveOracles(config.oracles);
  let rejectionScriptInstalled = false;
  let lastFailure: FailureArtifacts | undefined;
  let lastPassingTrace: string | undefined;

  return {
    ...(config.projectModel ? { projectModel: config.projectModel } : {}),
    ...(config.projectSut ? { projectSut: config.projectSut } : {}),
    ...(config.equivalent ? { equivalent: config.equivalent } : {}),
    create: async (
      _context: TestSutContext<TSnapshot, TEvent>
    ): Promise<TestSutSession<TSnapshot, TEvent>> => {
      const collected: string[] = [];
      const mockedRequests = new WeakSet<object>();
      const listeners: [string, (payload: any) => void][] = [];
      if (oracles && typeof page.on === 'function') {
        if (oracles.unhandledRejection && !rejectionScriptInstalled) {
          // Init scripts accumulate, so it is installed once per SUT.
          rejectionScriptInstalled = true;
          await page.addInitScript?.(REJECTION_SCRIPT);
        }
        listeners.push(
          [
            'pageerror',
            (error: unknown) => {
              if (oracles.pageError) {
                collected.push(
                  `pageerror: ${error instanceof Error ? error.message : String(error)}`
                );
              }
            }
          ],
          [
            'console',
            (message: { type: () => string; text: () => string }) => {
              const text = message.text();
              if (text.startsWith(REJECTION_PREFIX)) {
                if (oracles.unhandledRejection) {
                  collected.push(
                    `unhandledrejection: ${text.slice(REJECTION_PREFIX.length)}`
                  );
                }
                return;
              }
              const type = message.type();
              if (
                (type === 'error' && oracles.console) ||
                (type === 'warning' && oracles.console === 'warn')
              ) {
                collected.push(`console.${type}: ${text}`);
              }
            }
          ],
          [
            'response',
            (response: {
              status: () => number;
              url: () => string;
              request: () => { method: () => string };
            }) => {
              if (
                oracles.http === false ||
                response.status() < oracles.http ||
                mockedRequests.has(response.request())
              ) {
                return;
              }
              collected.push(
                `HTTP ${response.status()} ${response.request().method()} ${response.url()}`
              );
            }
          ]
        );
        for (const [event, listener] of listeners) {
          page.on(event, listener);
        }
      }
      const tracing = trace === 'off' ? undefined : page.context?.().tracing;
      let tracingStarted = false;
      if (tracing?.start) {
        try {
          await tracing.start({ screenshots: true, snapshots: true });
          tracingStarted = true;
        } catch {
          // Tracing is already running, for example from Playwright's own
          // `trace` setting; that trace records the run instead.
        }
      }
      await config.reset?.(page);
      let appliedCase: string | undefined;
      let checkpoints = 0;
      const stepScreenshots: Uint8Array[] = [];
      const installedRoutes: InstalledRoute[] = [];
      const mockPage = trackRoutes(page, installedRoutes, mockedRequests);

      return {
        send: async (
          event: TEvent,
          context?: TestSutSendContext<TSnapshot>
        ) => {
          // The generated event case is authoritative when the property runner
          // supplies one; `caseOf` remains the fallback.
          const resolved = resolveMock(
            config.mocks as
              | Record<string, PlaywrightMock<TPage> | undefined>
              | undefined,
            context?.case,
            caseOf(event)
          );
          if (resolved && resolved.key !== appliedCase) {
            // Remove the previous case's routes so its handlers stop
            // intercepting before the new case's mock installs its own.
            await releaseRoutes(page, installedRoutes);
            await resolved.mock(mockPage);
            appliedCase = resolved.key;
          }
          const action = (
            config.events as Record<
              string,
              PlaywrightEventAction<TPage, TEvent> | undefined
            >
          )[event.type];
          if (!action) {
            throw new Error(
              `No Playwright action configured for event "${event.type}"`
            );
          }
          if (config.step) {
            await config.step(formatStepName(event), async () => {
              await action(page, event);
            });
            return;
          }
          await action(page, event);
        },
        ...(config.read ? { read: () => config.read!(page) } : {}),
        ...(config.states
          ? {
              states: Object.fromEntries(
                Object.entries(config.states).map(([key, assertion]) => [
                  key,
                  (snapshot: TSnapshot) => assertion(page, snapshot)
                ])
              ) as unknown as TestStateAssertions<TSnapshot, TEvent>
            }
          : {}),
        settle: async () => {
          if (config.settle) {
            await config.settle(page);
            return;
          }
          await page.waitForLoadState?.('load');
          // Lets listeners for events the page has already emitted run.
          await new Promise<void>((resolve) => queueMicrotask(resolve));
        },
        check: async () => {
          if (screenshots === 'every-step') {
            const shot = await page.screenshot?.();
            if (shot) {
              stepScreenshots.push(shot);
            }
          }
          if (collected.length) {
            throw new PlaywrightOracleError(collected.splice(0));
          }
        },
        advance: async (milliseconds: number) => {
          if (config.advance) {
            return config.advance(page, milliseconds);
          }
          await page.clock?.runFor?.(milliseconds);
          return [];
        },
        checkpoint: async (label?: string) => {
          const resolved = label ?? `checkpoint-${checkpoints}`;
          checkpoints++;
          if (config.checkpoint) {
            await config.checkpoint(page, resolved);
            return;
          }
          await page.screenshot?.({
            path: `${screenshotDir}/${sanitizeLabel(resolved)}.png`
          });
        },
        ...(config.stop ? { stop: () => config.stop!(page) } : {}),
        dispose: async ({ passed }: TestSutDisposeContext) => {
          try {
            for (const [event, listener] of listeners) {
              page.off?.(event, listener);
            }
            if (!passed) {
              const screenshot =
                screenshots === 'on-failure'
                  ? await page.screenshot?.()
                  : undefined;
              let tracePath: string | undefined;
              if (tracingStarted) {
                // Every failing run overwrites the same file, so the file
                // left is the last failing run's: the shrunk counterexample.
                tracePath = testInfo!.outputPath(
                  'xstate-test-failure-trace.zip'
                );
                await tracing!.stop!({ path: tracePath });
              }
              lastFailure = {
                ...(tracePath ? { trace: tracePath } : {}),
                ...(screenshot ? { screenshot } : {}),
                steps: stepScreenshots.slice()
              };
            } else if (tracingStarted) {
              if (trace === 'on') {
                // Each passing run overwrites the last one's trace.
                lastPassingTrace = testInfo!.outputPath(
                  'xstate-test-trace.zip'
                );
                await tracing!.stop!({ path: lastPassingTrace });
              } else {
                await tracing!.stop!();
              }
            }
            await releaseRoutes(page, installedRoutes);
          } finally {
            await config.dispose?.(page);
          }
        }
      };
    },
    complete: async ({ passed, failure }: TestSutCompleteContext) => {
      const artifacts = lastFailure;
      const passingTrace = lastPassingTrace;
      lastFailure = undefined;
      lastPassingTrace = undefined;
      if (!testInfo) {
        return;
      }
      if (passed) {
        if (passingTrace) {
          await testInfo.attach('trace', {
            path: passingTrace,
            contentType: 'application/zip'
          });
        }
        return;
      }
      const fixture = (failure as { fixture?: TestFixture } | undefined)
        ?.fixture;
      if (fixture) {
        await testInfo.attach('fixture.json', {
          body: JSON.stringify(fixture, null, 2),
          contentType: 'application/json'
        });
      }
      if (artifacts?.trace) {
        await testInfo.attach('trace', {
          path: artifacts.trace,
          contentType: 'application/zip'
        });
      }
      if (artifacts?.screenshot) {
        await testInfo.attach('failure.png', {
          body: artifacts.screenshot,
          contentType: 'image/png'
        });
      }
      for (const [index, shot] of (artifacts?.steps ?? []).entries()) {
        await testInfo.attach(`step-${index}.png`, {
          body: shot,
          contentType: 'image/png'
        });
      }
    }
  };
}
