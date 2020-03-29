import * as React from 'react';
import { InvokeDefinition } from 'xstate';

function formatInvoke(src: string): string {
  if (isUnnamed(src)) {
    const [_, index] = src.match(/:invocation\[(\d+)\]$/);

    return `anonymous (${index})`;
  }

  return src;
}

function isUnnamed(src: string): boolean {
  return /:invocation\[/.test(src);
}

export function InvokeViz({ invoke }: { invoke: InvokeDefinition<any, any> }) {
  return (
    <div
      data-xviz="stateNode-invoke"
      data-xviz-unnamed={isUnnamed(invoke.src) || undefined}
    >
      <div data-xviz="stateNode-invoke-src">{formatInvoke(invoke.src)}</div>
      <div data-xviz="stateNode-invoke-id">{invoke.id}</div>
    </div>
  );
}
