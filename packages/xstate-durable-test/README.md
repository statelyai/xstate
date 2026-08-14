# `@xstate/durable-test`

Vitest conformance tests for XState durable execution adapters.

<!-- install command for package.json#name and peerDependencies -->

```sh
pnpm add -D @xstate/durable-test vitest xstate
```

<!-- public API from src/index.ts -->

| Export | Purpose |
| --- | --- |
| `durableExecutionConformance(options)` | Registers the supported durable adapter contract tests |
| `DurableConformanceCapability` | Capability names selectable by a harness |
| `DurableConformanceHarness` | Interface implemented by a host-backed test harness |
| `DurableConformanceExecution` | Controls one running conformance execution |
| `DurableConformanceOperation` | Observable operation recorded by a harness |
| `DurableConformanceOptions` | Suite name, harness factory and supported capabilities |

```ts
import {
  durableExecutionConformance,
  type DurableConformanceHarness
} from '@xstate/durable-test';

const harness: DurableConformanceHarness = createMyHostHarness();

durableExecutionConformance({
  name: 'my durable host',
  createHarness: () => harness,
  capabilities: new Set([
    'actions',
    'timers',
    'actors',
    'actorCommunication',
    'mailbox',
    'errors',
    'output'
  ])
});
```

Declare only capabilities the adapter implements. The suite runs entirely
against the supplied harness and does not start vendor infrastructure.
