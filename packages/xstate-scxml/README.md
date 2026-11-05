# @xstate/scxml

Create [XState](https://github.com/statelyai/xstate) machines from [SCXML](https://www.w3.org/TR/scxml/) documents.

## Install

```bash
npm i xstate@beta @xstate/scxml@beta
```

## Usage

```ts
import { createActor } from 'xstate';
import { createMachineFromSCXML } from '@xstate/scxml';

const machine = createMachineFromSCXML(`
  <scxml xmlns="http://www.w3.org/2005/07/scxml" version="1.0" initial="idle">
    <state id="idle">
      <transition event="START" target="running"/>
    </state>
    <state id="running"/>
  </scxml>
`);

const actor = createActor(machine).start();
actor.send({ type: 'START' });
```

<!-- experimental public API from src/scxml.ts and compatibility contract from ../../docs/scxml.md -->

`@xstate/scxml` is experimental. Imported machines use SCXML transition domains, event matching, and document ordering, which differ from native XState v6 machines.

See the [SCXML guide](https://github.com/statelyai/xstate/blob/next/docs/scxml.md) for the compatibility contract, supported execution profile, and synchronous resource resolution.
