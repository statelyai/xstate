# @xstate/webmcp

## 0.1.0-beta.0

### Minor Changes

- 765220e: Add `@xstate/webmcp`, which exposes XState actors and `@xstate/store` stores as [WebMCP](https://webmachinelearning.github.io/webmcp/) tools. Each exposed event becomes a tool whose input schema comes from the event schema. Tool names are derived from event types (`checkout.confirm` becomes `checkout_confirm`), and the `toolName` option changes the mapping. For machine actors, tools are registered only while the current state handles their event. Custom tools can send several events and wait for a state.
  
  ```ts
  import { createWebMCP } from '@xstate/webmcp';
  
  const registration = createWebMCP(actor, {
    events: ['cart.*'],
    tools: ({ tool }) => ({
      quickCheckout: tool({
        description: 'Add the given items and start checkout.',
        input: z.object({ skus: z.array(z.string()) }),
        async execute({ skus }, { send, waitFor }) {
          for (const sku of skus) send({ type: 'cart.add', sku });
          send({ type: 'checkout.start' });
          await waitFor((s) => s.matches('checkout'));
          return { ok: true };
        }
      })
    })
  }).register();
  ```
