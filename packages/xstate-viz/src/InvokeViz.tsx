import * as React from 'react';
import { InvokeDefinition } from 'xstate';

function formatInvoke(id: string): string {
  if (isUnnamed(id)) {
    const [, index] = id.match(/:invocation\[(\d+)\]$/);

    return `anonymous (${index})`;
  }

  return id;
}

function isUnnamed(id: string): boolean {
  return /:invocation\[/.test(id);
}

export function InvokeViz({ invoke }: { invoke: InvokeDefinition<any, any> }) {
  return (
    <div
      data-xviz="invoke"
      data-xviz-unnamed={isUnnamed(invoke.id) || undefined}
    >
      <div data-xviz="invoke-src">{invoke.src}</div>
      <div data-xviz="invoke-id">{formatInvoke(invoke.id)}</div>
    </div>
  );
}
