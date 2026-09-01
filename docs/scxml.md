---
title: SCXML
---

# SCXML

Use `createMachineFromSCXML(...)` to create an XState machine from an [SCXML](https://www.w3.org/TR/scxml/) document.

Import it from the opt-in `xstate/scxml` entry point. The XML parser is kept out of the main `xstate` entry point.

```ts
import { createActor } from 'xstate';
import { createMachineFromSCXML } from 'xstate/scxml';

const machine = createMachineFromSCXML(`
  <scxml xmlns="http://www.w3.org/2005/07/scxml"
    version="1.0"
    initial="idle">
    <state id="idle">
      <transition event="START" target="running" />
    </state>
    <state id="running" />
  </scxml>
`);

const actor = createActor(machine).start();
actor.send({ type: 'START' });
```

The returned value is an XState machine and can be passed to `createActor(...)`, `initialTransition(...)`, and other machine utilities.

> Only create machines from trusted SCXML. ECMAScript expressions and `<script>` elements execute JavaScript in the current environment.

## External resources

SCXML can reference external data, scripts, and invoked documents. Provide a synchronous `resolveResource` function to load those resources:

```ts
const machine = createMachineFromSCXML(source, {
  resolveResource: (src, kind) => {
    // kind is "data", "script", or "invoke".
    return resources[src];
  }
});
```

If an SCXML document references an external resource and no resolver is provided, machine creation throws an error identifying the resource kind and source.

## Machine JSON

SCXML is compiled through a private representation because SCXML executable content and transition semantics cannot be represented losslessly as ordinary `MachineJSON`. Use `createMachineFromConfig(...)` for serialized XState definitions and `createMachineFromSCXML(...)` for SCXML documents.
