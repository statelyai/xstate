---
'xstate': minor
---

Added a `createSelector`, which can be used for creating type-safe selectors for machines. For instance, when used with React:

```ts
import { createMachine, createSelector } from 'xstate';
import { useInterpret, useSelector } from '@xstate/react';

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
