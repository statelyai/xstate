---
'xstate': minor
---

Export setup helper types for libraries that return or decorate setup-bound objects while preserving native `setup(...).createMachine(...)` typing.

```ts
import { setup, type AnySetupConfig, type SetupReturnFromConfig } from 'xstate';

function decorateSetup<const TConfig extends AnySetupConfig>(
  config: TConfig
): SetupReturnFromConfig<TConfig> & { extra: true } {
  const s = setup(config) as SetupReturnFromConfig<TConfig>;

  return Object.assign(s, { extra: true as const });
}
```
