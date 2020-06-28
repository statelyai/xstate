import * as React from 'react';
import { useContext } from 'react';
import { InvokeDefinition } from 'xstate';
import { ServicesContext } from './InspectorViz';
import { ActorRefViz } from './ActorRefViz';

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
  const service = useContext(ServicesContext);

  return (
    <div
      data-xviz="invoke"
      data-xviz-unnamed={isUnnamed(invoke.id) || undefined}
      onClick={() => {
        service.send({
          type: 'service.select',
          id: invoke.id
        });
      }}
    >
      <div data-xviz="invoke-src">{invoke.src}</div>
      <div data-xviz="invoke-id">
        <ActorRefViz actorRefId={invoke.id}>
          {formatInvoke(invoke.id)}
        </ActorRefViz>
      </div>
    </div>
  );
}
