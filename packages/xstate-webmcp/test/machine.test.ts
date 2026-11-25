import { createActor, createAsyncLogic, createMachine } from 'xstate';
import { z } from 'zod';
import { createMockModelContext, createWebMCP } from '../src/index.ts';

const placeOrder = createAsyncLogic({
  run: async ({ input }: { input: { items: string[] } }) => {
    if (input.items.includes('broken')) {
      throw new Error('Payment failed');
    }
    return `order-${input.items.length}`;
  }
});

const checkoutMachine = createMachine({
  schemas: {
    events: {
      'cart.add': z
        .object({ sku: z.string() })
        .describe('Add an item to the cart.'),
      'cart.clear': z.object({}),
      'checkout.start': z.object({}).describe('Start checkout.'),
      'checkout.confirm': z.object({}).describe('Place the order.'),
      cancel: z.object({}).describe('Cancel checkout.')
    }
  },
  context: { items: [] as string[], orderId: null as string | null },
  initial: 'shopping',
  states: {
    shopping: {
      on: {
        'cart.add': ({ context, event }) => ({
          context: { ...context, items: [...context.items, event.sku] }
        }),
        'cart.clear': {
          description: 'Remove every item from the cart.',
          to: ({ context }) => ({ context: { ...context, items: [] } })
        },
        'checkout.start': ({ context }) =>
          context.items.length > 0 ? { target: 'checkout' } : undefined
      }
    },
    checkout: {
      on: {
        'checkout.confirm': { target: 'placing' },
        cancel: { target: 'shopping' }
      }
    },
    placing: {
      invoke: {
        src: placeOrder,
        input: ({ context }) => ({ items: context.items }),
        onDone: ({ context, event }) => ({
          target: 'confirmed',
          context: { ...context, orderId: event.output }
        })
      }
    },
    confirmed: { type: 'final' }
  }
});

const names = (tools: readonly { name: string }[]) =>
  tools.map((tool) => tool.name).sort();

describe('machine tools', () => {
  it('uses transition descriptions when the schema has none', () => {
    const actor = createActor(checkoutMachine).start();
    const webMCP = createWebMCP(actor, { events: 'cart.clear' });

    expect(webMCP.tools[0]).toMatchObject({
      name: 'cart_clear',
      description: 'Remove every item from the cart.'
    });
  });

  it('only offers tools the current state handles', () => {
    const actor = createActor(checkoutMachine).start();
    const webMCP = createWebMCP(actor, { events: '*' });

    expect(names(webMCP.tools)).toEqual([
      'cancel',
      'cart_add',
      'cart_clear',
      'checkout_confirm',
      'checkout_start',
      'get_state'
    ]);
    expect(names(webMCP.getAvailableTools())).toEqual([
      'cart_add',
      'cart_clear',
      'checkout_start',
      'get_state'
    ]);

    actor.send({ type: 'cart.add', sku: 'apple' });
    actor.send({ type: 'checkout.start' });

    expect(names(webMCP.getAvailableTools())).toEqual([
      'cancel',
      'checkout_confirm',
      'get_state'
    ]);
  });

  it('registers and unregisters tools as the state changes', async () => {
    const actor = createActor(checkoutMachine).start();
    const modelContext = createMockModelContext();
    const registration = createWebMCP(actor, { events: '*' }).register({
      modelContext
    });

    await registration.ready;
    expect(modelContext.getToolNames().sort()).toEqual([
      'cart_add',
      'cart_clear',
      'checkout_start',
      'get_state'
    ]);

    await expect(
      modelContext.executeTool('cart_add', { sku: 'apple' })
    ).resolves.toEqual({ status: 'active', state: 'shopping' });
    await modelContext.executeTool('checkout_start');
    await Promise.resolve();

    expect(modelContext.getToolNames().sort()).toEqual([
      'cancel',
      'checkout_confirm',
      'get_state'
    ]);

    registration.unregister();
    actor.send({ type: 'cancel' });
    await Promise.resolve();

    expect(modelContext.getToolNames()).toEqual([]);
  });

  it('unregisters event tools when the machine finishes', async () => {
    const actor = createActor(checkoutMachine).start();
    const modelContext = createMockModelContext();

    await createWebMCP(actor, { events: '*' }).register({ modelContext }).ready;

    actor.send({ type: 'cart.add', sku: 'apple' });
    actor.send({ type: 'checkout.start' });
    actor.send({ type: 'checkout.confirm' });
    await vi.waitFor(() => expect(actor.getSnapshot().status).toBe('done'));

    expect(modelContext.getToolNames()).toEqual(['get_state']);
    await expect(modelContext.executeTool('get_state')).resolves.toEqual({
      status: 'done',
      state: 'confirmed'
    });
  });

  it('rejects an event the state cannot take, including guarded ones', async () => {
    const actor = createActor(checkoutMachine).start();
    const webMCP = createWebMCP(actor, {
      events: '*',
      availability: 'always'
    });
    const byName = (name: string) =>
      webMCP.tools.find((tool) => tool.name === name)!;

    expect(webMCP.getAvailableTools()).toHaveLength(webMCP.tools.length);
    await expect(byName('checkout_start').execute({})).rejects.toThrow(
      'Tool "checkout_start" cannot run in the current state. Available tools: cart_add, cart_clear, checkout_start, get_state.'
    );
    await expect(byName('cancel').execute({})).rejects.toThrow(
      /Tool "cancel" cannot run in the current state/
    );
    expect(actor.getSnapshot().value).toBe('shopping');
  });

  it('runs a custom tool that sends several events and waits', async () => {
    const actor = createActor(checkoutMachine).start();
    const modelContext = createMockModelContext();
    const webMCP = createWebMCP(actor, {
      events: [],
      tools: ({ tool }) => ({
        quickCheckout: tool({
          description: 'Buy the given items.',
          input: z.object({ skus: z.array(z.string()).min(1) }),
          annotations: { consequentialHint: true },
          async execute({ skus }, { send, waitFor }) {
            for (const sku of skus) {
              send({ type: 'cart.add', sku });
            }
            send({ type: 'checkout.start' });
            send({ type: 'checkout.confirm' });
            const snapshot = await waitFor((s) => s.matches('confirmed'));
            return { orderId: snapshot.context.orderId };
          }
        })
      })
    });

    await webMCP.register({ modelContext }).ready;

    await expect(
      modelContext.executeTool('quickCheckout', { skus: ['a', 'b'] })
    ).resolves.toEqual({ orderId: 'order-2' });
  });

  it('rejects waitFor when the machine errors', async () => {
    const actor = createActor(checkoutMachine);
    actor.subscribe({ error: () => {} });
    actor.start();
    const webMCP = createWebMCP(actor, {
      events: [],
      stateTool: false,
      tools: ({ tool }) => ({
        buyBroken: tool({
          description: 'Buy a broken item.',
          async execute(_input, { send, waitFor }) {
            send({ type: 'cart.add', sku: 'broken' });
            send({ type: 'checkout.start' });
            send({ type: 'checkout.confirm' });
            return waitFor((s) => s.matches('confirmed'));
          }
        })
      })
    });

    await expect(webMCP.tools[0].execute({})).rejects.toThrow('Payment failed');
  });
});
