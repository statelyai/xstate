# @xstate/scxml

Create [XState](https://github.com/statelyai/xstate) machines from [SCXML](https://www.w3.org/TR/scxml/) documents.

## Install

```bash
npm i xstate @xstate/scxml
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

See the [SCXML guide](https://github.com/statelyai/xstate/blob/main/docs/scxml.md) for resource resolution and supported features.
