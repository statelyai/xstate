import * as React from 'react';
import { InvokeDefinition } from 'xstate';

export function InvokeViz({ invoke }: { invoke: InvokeDefinition<any, any> }) {
  return (
    <div data-xviz-element="stateNode-invoke">
      <div data-xviz-element="stateNode-invoke-src">{invoke.src}</div>
      <div data-xviz-element="stateNode-invoke-id">{invoke.id}</div>
    </div>
  );
}
