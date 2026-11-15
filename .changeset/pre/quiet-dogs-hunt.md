---
"@xstate/effect": minor
---

Export `causeFromError` and `UnwrapEffectFailure` to inspect typed actor failures while preserving the original Effect Cause. Ordinary errors are wrapped with `Cause.fail`.

```ts
import { Cause } from 'effect';
import { causeFromError } from '@xstate/effect';

const failure = Cause.findErrorOption(causeFromError(event.error));
```
