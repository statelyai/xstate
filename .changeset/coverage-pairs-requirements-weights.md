---
'xstate': minor
'@xstate/fast-check': minor
---

Property test coverage now reports two more dimensions, and event cases and
commands can be weighted.

`coverage.transitionPairs` reports which pairs of transitions ran back to back
within a run, and `coverage.requirements` reports requirement ids declared via
`meta.requirements` on state nodes and transitions:

```ts
const machine = createMachine({
  initial: 'idle',
  states: {
    idle: {
      meta: { requirements: 'REQ-1' },
      on: { SUBMIT: { target: 'sent', meta: { requirements: ['REQ-2'] } } }
    },
    sent: {}
  }
});

const { coverage } = await propertyTest(machine, options);

coverage.transitionPairs.uncovered;
coverage.requirements.uncovered;
coverage.requirements.sources['REQ-2'];
```

Event cases and `commands` entries accept an optional `weight` (a positive,
finite number, `1` by default) that controls how often they are generated
relative to each other:

```ts
await propertyTest(machine, {
  adapter: fastCheckAdapter(),
  events: {
    INC: { generate: fc.record({ value: fc.integer() }), weight: 10 },
    RESET: { generate: fc.constant({}), weight: 1 }
  },
  commands: {
    stop: { generate: fc.constant({}), weight: 0.1 }
  },
  invariant
});
```
