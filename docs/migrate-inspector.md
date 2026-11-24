---
title: Migrate to SDK inspection
description: Replace legacy Stately Inspect integrations with the Stately SDK.
---

Use `@statelyai/sdk/inspect` for visual inspection with XState v6. The SDK accepts XState v5 and v6 inspection events. The legacy `@statelyai/inspect` package remains available for existing XState v5 integrations.

The SDK is not a drop-in replacement. Check the options and transport changes below before removing the legacy package. This guide describes `@statelyai/sdk` 0.48.0.

## Install and connect

```bash
npm install @statelyai/sdk
```

Replace the browser factory with the SDK factory:

```ts
// Before: XState v5
import { createBrowserInspector } from '@statelyai/inspect';

const inspector = createBrowserInspector();
```

```ts
// After: XState v6
import { createActor } from 'xstate';
import { createInspector } from '@statelyai/sdk/inspect';
import { machine } from './machine';

const inspector = createInspector();
const actor = createActor(machine, { inspect: inspector.inspect });
actor.start();

await inspector.ready;
console.log(inspector.inspectorUrl);
```

The SDK connects to the hosted relay without an API key. `inspector.ready` resolves after relay registration and the initial-state flush. Open `inspector.inspectorUrl` after it resolves. If you supply a custom transport, the URL is `null` and your transport controls the viewer connection.

The SDK's `inspect` property is a callback. Pass it directly to `createActor` instead of calling the legacy observer's `inspect.next(...)` method. To inspect an actor that already exists, call `inspector.attach(actor)`.

The SDK has no XState peer dependency restriction, but currently depends on XState v5 internally. An application using XState v6 can have both versions installed.

## Open the viewer

The SDK does not open a popup automatically. In a browser, expose `inspector.inspectorUrl` as a link after `inspector.ready` resolves. Let the user open it from a click or another user gesture.

In Node, request automatic browser launch:

```ts
import { createInspector } from '@statelyai/sdk/inspect';

const inspector = createInspector({ launch: 'browser' });
```

`launch: 'browser'` is supported from Node, not from a browser runtime.

## Include selected context

The default snapshot serializer sends `value`, `status`, and available tags. It omits context. Use `serializeSnapshot` to include fields that your viewer needs:

```ts
import { createInspector } from '@statelyai/sdk/inspect';

const inspector = createInspector({
  serializeSnapshot: (snapshot) => {
    const context = snapshot.context;
    const orderId =
      context !== null &&
      typeof context === 'object' &&
      'orderId' in context &&
      typeof context.orderId === 'string'
        ? context.orderId
        : undefined;

    return {
      value: snapshot.value,
      status: snapshot.status,
      tags: snapshot.tags ? Array.from(snapshot.tags) : [],
      context: { orderId }
    };
  }
});
```

Return JSON-serializable data. Avoid sending actor references, DOM nodes, credentials, or personal data. This serializer controls snapshots only; it does not redact event payloads or machine definitions.

## Disconnect inspection

Replace the legacy `inspector.stop()` teardown call with:

```ts
inspector.destroy();
```

This closes inspection and its subscriptions. It does not stop the application actors. The SDK's `stop(actorId)` method marks a manually inspected actor as stopped; it is not a teardown method. The SDK has no equivalent of the legacy `autoStart: false` and `start()` lifecycle.

## Migrate manual inspection

Both packages support manual actors, events, and snapshots, but actor registration has a different shape:

```ts
// Before
inspector.actor('request', { status: 'active' }, { parentId: 'server' });
```

```ts
// After
inspector.actor('request', {
  snapshot: { status: 'active' },
  parent: 'server'
});
```

Pass actor IDs as strings. Replace actor-reference arguments with their corresponding manual IDs. Map a legacy `definition` to the SDK's `machine` option, and provide a machine config or source string rather than assuming the old serialized definition is accepted.

`inspector.snapshot(id, snapshot, event)` takes the triggering event directly as its third argument. The legacy API takes `{ event }` there. `inspector.event(id, event, { source })` continues to accept a source, but the SDK expects the source actor's ID as a string.

## Check unsupported options and transports

| Legacy API                                                | SDK migration                                                                                                                                                                          |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `createInspector(adapter, options)`                       | `createInspector(options)` has a different signature. A custom SDK `transport` must implement the SDK transport interface.                                                             |
| `createWebSocketInspector({ url })`                       | Use `createInspector({ url })` with a compatible SDK relay. The SDK `url` is a relay URL, not a viewer URL.                                                                            |
| `createInspectorServer` from `@statelyai/inspect/server`  | For local inspection, use `createNodeInspectionRelay` from `@statelyai/sdk/node-relay`. Install its `ws` peer dependency and start the relay before connecting.                        |
| `createBrowserReceiver`, `createWebSocketReceiver`        | There are no matching SDK exports. Keep the legacy receiver until its integration supports the SDK protocol.                                                                           |
| `iframe`, custom `window`, browser `send` override        | There is no equivalent option on the SDK inspector factory. Keep the legacy integration until the viewer integration is migrated.                                                      |
| `filter`, `serialize`, `sanitizeEvent`, `sanitizeContext` | There are no matching SDK options. `serializeSnapshot` only controls snapshots. Keep the legacy integration if it requires event filtering or sanitization that has not been replaced. |
| `maxDeferredEvents`, `serializationDepthLimit`            | There are no matching SDK options. Do not pass them and assume they take effect.                                                                                                       |
| `createSkyInspector({ apiKey })`                          | The SDK has an `apiKey` option for hosted session ownership, but it uses a different session and transport protocol. Migrate the hosted integration explicitly.                        |

The legacy popup, WebSocket receiver, and local bridge exchange legacy inspection messages. SDK relays exchange room and producer messages. Changing the package name or server URL does not make these protocols compatible.

After migrating and verifying your integration, remove `@statelyai/inspect` if no other code uses it:

```bash
npm uninstall @statelyai/inspect
```

See [Inspect actor systems](inspect-actor-systems.md) for the v6 inspection workflow and [Inspection](inspection.md) for XState's event types.
