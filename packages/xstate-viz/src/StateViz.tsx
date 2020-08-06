import * as React from "react";
import { State } from "xstate";
import { JSONViz, JSONCustomViz } from "./JSONViz";
import { ActorRefViz } from "./ActorRefViz";

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
  const cleanedState = React.useMemo(() => {
    const {
      value,
      context,
      event,
      _event,
      _sessionid,
      actions,
      children,
      meta,
      changed,
    } = state;

    const formattedChildren: any = {};

    Object.entries(children).forEach(([key, value]) => {
      formattedChildren[key] = {
        $$type: "actorRef",
        id: value.id,
        meta: value.meta,
      };
    });

    return {
      value,
      context,
      event,
      _event,
      _sessionid,
      actions,
      children: formattedChildren,
      meta,
      changed,
    };
  }, [state]);

  return (
    <div data-xviz="state">
      <div data-xviz="state-value">
        <JSONViz
          valueKey="state"
          path={[]}
          value={cleanedState as any}
          options={{
            initialOpen: (value, path) => {
              if (path.length === 1) {
                return true;
              }

              if (path[1] === "context" && path.length === 1) {
                return true;
              }
              if (path[1] === "value") {
                return true;
              }
              if (path[0] === "meta") {
                return false;
              }

              return false;
            },
          }}
          renderValue={(value, path) => {
            if (
              typeof value === "object" &&
              value !== null &&
              "$$type" in value &&
              value.$$type === "actorRef"
            ) {
              return (
                <JSONCustomViz valueKey={path[path.length - 1]} path={path}>
                  <ActorRefViz actorRefId={value.id} />
                </JSONCustomViz>
              );
            }
          }}
        />
      </div>
    </div>
  );
}
