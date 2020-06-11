import * as React from 'react';
import { State } from 'xstate';
import { JSONViz } from './JSONViz';

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
        <JSONViz valueKey="root" value={state.toJSON()} />
      </div>
    </div>
  );
}
