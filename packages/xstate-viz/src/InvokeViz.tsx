import * as React from "react";
import { InvokeDefinition } from "xstate";
import { ActorRefViz } from "./ActorRefViz";

export function formatInvocationId(id: string): string {
  if (isUnnamed(id)) {
    const [, index] = id.match(/:invocation\[(\d+)\]$/);

    return `anonymous [${index}]`;
  }

  return id;
}

function isUnnamed(id: string): boolean {
  return /:invocation\[/.test(id);
}

export function InvokeViz({ invoke }: { invoke: InvokeDefinition<any, any> }) {
  const invokeSrc =
    typeof invoke.src === "string" ? invoke.src : invoke.src.type;

  return (
    <div
      data-xviz="invoke"
      data-xviz-unnamed={isUnnamed(invoke.id) || undefined}
    >
      <div data-xviz="invoke-src">{invokeSrc}</div>
      <div data-xviz="invoke-id">
        <ActorRefViz actorRefId={invoke.id}>
          {formatInvocationId(invoke.id)}
        </ActorRefViz>
      </div>
    </div>
  );
}
