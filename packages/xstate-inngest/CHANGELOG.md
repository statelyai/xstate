# @xstate/inngest

## 0.1.0-alpha.1

### Minor Changes

- 86f7303: Add experimental durable execution adapters for Inngest and Rivet workflows.
  Host runtime mappings now receive the complete built-in effect, allowing them
  to map timers, sends and child actors without coupling XState to either host.
  
  ```ts
  import { createDurable } from '@xstate/inngest';
  
  const output = await createDurable(machine, options).run(input);
  ```
