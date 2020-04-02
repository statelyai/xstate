import * as React from 'react';
import { State } from 'xstate';

type JSONValue =
  | string
  | number
  | boolean
  | null
  | { [property: string]: JSONValue }
  | JSONValue[];

export function JsonViz({ value }: { value: JSONValue }) {
  return <pre data-xviz="json">{JSON.stringify(value, null, 2)}</pre>;
}

export function StateViz({ state }: { state: State<any, any> }) {
  return (
    <div data-xviz="state">
      <div data-xviz="state-value">
        <JsonViz value={state.value} />
      </div>
      <div data-xviz="state-context">
        <JsonViz value={state.context} />
      </div>
    </div>
  );
}
