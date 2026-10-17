import { z } from 'zod';
import { createMachine, setup } from '../src';

const child = createMachine({
  schemas: { input: z.object({ n: z.number() }) }
});
const optionalInputChild = createMachine({
  schemas: { input: z.object({ n: z.number() }).optional() }
});
const noInputChild = createMachine({});

describe('required invoke input', () => {
  it('is required for inline actor logic that requires input', () => {
    createMachine({
      // @ts-expect-error input is required by the invoked logic
      invoke: { src: child }
    });
    createMachine({ invoke: { src: child, input: { n: 1 } } });
    createMachine({
      invoke: { src: child, input: () => ({ n: 1 }) }
    });
  });

  it('is required for registered actor sources', () => {
    const s = setup({ actors: { child } });
    s.createMachine({
      // @ts-expect-error input is required by the registered source
      invoke: { src: 'child' }
    });
    s.createMachine({
      // @ts-expect-error input is required by the registered logic
      invoke: { src: child }
    });
    s.createMachine({
      // @ts-expect-error input is required by the resolved logic
      invoke: { src: ({ actors }) => actors.child }
    });
    s.createMachine({ invoke: { src: 'child', input: { n: 1 } } });
    s.createMachine({
      invoke: { src: ({ actors }) => actors.child, input: { n: 1 } }
    });
  });

  it('is required in invoke arrays and nested states', () => {
    createMachine({
      initial: 'a',
      states: {
        a: {
          // @ts-expect-error the second invoke requires input
          invoke: [{ src: noInputChild }, { src: child }]
        }
      }
    });
    createMachine({
      initial: 'a',
      states: {
        a: {
          invoke: [{ src: noInputChild }, { src: child, input: { n: 1 } }]
        }
      }
    });
  });

  it('is optional when the input type allows undefined', () => {
    createMachine({ invoke: { src: optionalInputChild } });
    createMachine({ invoke: { src: noInputChild } });
    setup({ actors: { optionalInputChild } }).createMachine({
      invoke: { src: 'optionalInputChild' }
    });
  });

  it('is required in setup.createInvoke and setup.createStateConfig', () => {
    const s = setup({ states: { a: {} } });
    s.createMachine({
      initial: 'a',
      states: {
        a: {
          // @ts-expect-error input is required by the invoked logic
          invoke: s.createInvoke({ src: child })
        }
      }
    });
    s.createMachine({
      initial: 'a',
      states: {
        a: { invoke: s.createInvoke({ src: child, input: { n: 1 } }) }
      }
    });
    s.createStateConfig('a', {
      // @ts-expect-error input is required by the invoked logic
      invoke: { src: child }
    });
    s.createStateConfig({
      // @ts-expect-error input is required by the invoked logic
      invoke: { src: child }
    });
    s.createStateConfig('a', { invoke: { src: child, input: { n: 1 } } });
  });

  it('reports a readable error', () => {
    setup({ actors: { child } }).createMachine({
      // @ts-expect-error This actor logic requires input. Add an `input` to this invoke.
      invoke: { src: 'child' }
    });
  });
});

describe('required spawn input', () => {
  it('is required for context spawn and enq.spawn', () => {
    createMachine({
      // @ts-expect-error input is required by the spawned logic
      context: ({ spawn }) => ({ ref: spawn(child) })
    });
    createMachine({
      context: ({ spawn }) => ({ ref: spawn(child, { input: { n: 1 } }) })
    });
    createMachine({
      context: ({ spawn }) => ({ ref: spawn(optionalInputChild) })
    });
    createMachine({
      entry: (_, enq) => {
        // @ts-expect-error input is required by the spawned logic
        enq.spawn(child);
        enq.spawn(child, { input: { n: 1 } });
        enq.spawn(noInputChild);
      }
    });
    setup({ actors: { child } }).createMachine({
      entry: (_, enq) => {
        // @ts-expect-error input is required by the registered source
        enq.spawn('child');
        enq.spawn('child', { input: { n: 1 } });
      }
    });
  });
});

describe('undefined input', () => {
  it('does not provide required input', () => {
    createMachine({
      // @ts-expect-error input is required by the invoked logic
      invoke: { src: child, input: undefined }
    });
    createMachine({
      // @ts-expect-error the mapper returns no input
      invoke: { src: child, input: () => undefined }
    });
    createMachine({ invoke: { src: optionalInputChild, input: undefined } });
    createMachine({
      context: ({ spawn }) => ({
        // @ts-expect-error input is required by the spawned logic
        ref: spawn(child, { input: undefined })
      })
    });
    createMachine({
      entry: (_, enq) => {
        // @ts-expect-error input is required by the spawned logic
        enq.spawn(child, { input: undefined });
      }
    });
  });
});
