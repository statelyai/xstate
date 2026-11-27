# Expose actors to browser agents

[WebMCP](https://webmachinelearning.github.io/webmcp/) lets a web page register tools that browser agents can call. The `@xstate/webmcp` package turns the events of an XState actor into WebMCP tools. Each tool validates its input with the event schema and sends the event to the actor.

```bash
npm install @xstate/webmcp
```

## Turn events into tools

Give each event you want to expose a schema with a description, then pass the actor to `createWebMCP`:

```ts
import { createActor, createMachine } from 'xstate';
import { createWebMCP } from '@xstate/webmcp';
import { z } from 'zod';

const checkoutMachine = createMachine({
  schemas: {
    events: {
      'cart.add': z
        .object({ sku: z.string() })
        .describe('Add an item to the cart.'),
      'checkout.start': z.object({}).describe('Start checkout.'),
      cancel: z.object({}).describe('Cancel checkout.')
    }
  },
  context: { items: [] as string[] },
  initial: 'shopping',
  states: {
    shopping: {
      on: {
        'cart.add': ({ context, event }) => ({
          context: { items: [...context.items, event.sku] }
        }),
        'checkout.start': ({ context }) =>
          context.items.length > 0 ? { target: 'checkout' } : undefined
      }
    },
    checkout: {
      on: { cancel: { target: 'shopping' } }
    }
  }
});

const actor = createActor(checkoutMachine).start();
const registration = createWebMCP(actor, { events: '*' }).register();
```

The `events` option lists the events agents can send. It accepts exact event types, trailing wildcards such as `'cart.*'`, and `'*'`.

When a schema has no description, the transition's `description` is used instead, including a matching wildcard transition such as `cart.*`. Tool names replace `.` in event types with `_`, so `cart.add` becomes the `cart_add` tool. Pass a `toolName(eventType, schema)` function to change this mapping.

## Tools follow the current state

A tool is registered only while the current state has a transition for its event. In the example above, the `shopping` state registers the `cart_add` and `checkout_start` tools. After checkout starts, those are unregistered and `cancel` is registered. A read-only `get_state` tool is always registered.

Before a tool sends its event, it checks `snapshot.can(event)`. If a guard rejects the event, the call fails with an error that lists the tools the current state accepts. In the example, `checkout_start` fails while the cart is empty.

Pass `availability: 'always'` to keep every tool registered.

## Combine events in one tool

Custom tools can send several events and wait for a state:

```ts
// Replace the registration above, which already owns `get_state`.
registration.unregister();

const quickCheckoutActor = createActor(checkoutMachine).start();
const webMCP = createWebMCP(quickCheckoutActor, {
  events: [],
  tools: ({ tool }) => ({
    quickCheckout: tool({
      description: 'Add the given items and start checkout.',
      input: z.object({ skus: z.array(z.string()).min(1) }),
      async execute({ skus }, { send, getSnapshot, waitFor }) {
        if (!getSnapshot().matches('shopping')) {
          throw new Error('Checkout has already started.');
        }
        for (const sku of skus) {
          send({ type: 'cart.add', sku });
        }
        send({ type: 'checkout.start' });
        const snapshot = await waitFor((s) => s.matches('checkout'));
        return { items: snapshot.context.items };
      }
    })
  })
});

webMCP.register();
```

`send` and `waitFor` are typed from the actor, and `execute` input is typed from `input`.

## Next steps

See the [`@xstate/webmcp` README](https://github.com/statelyai/xstate/tree/main/packages/xstate-webmcp#readme) for tool results, overrides, registration options, `@xstate/store` support, and testing with `createMockModelContext`.
