---
'@xstate/react': minor
---

Added a `createSelector`, which can be used for creating type-safe selectors for machines. For instance:

```ts
import { createMachine } from 'xstate';
import { useInterpret, useSelector, createSelector } from '@xstate/react';

const machine = createMachine({
  initial: 'toggledOn',
  states: {
    toggledOn: {}
  }
});

const getIsToggledOn = createSelector(machine, (state) =>
  state.matches('toggledOn')
);

const Component = () => {
  const service = useInterpret(machine);

  const isToggledOn = useSelector(service, getIsToggledOn);
};
```
