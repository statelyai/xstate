import * as React from "react";
import { State } from "xstate";
import { JSONViz, JSONCustomViz } from "./JSONViz";
import { ActorRefViz } from "./ActorRefViz";
import { ServicesContext } from "./InspectorViz";

const SessionSelectViz: React.FC<{
  service?: string;
  onSelectSession: (sessionId: string) => void;
}> = ({ service, onSelectSession }) => {
  const servicesService = React.useContext(ServicesContext);

  if (!servicesService) return null;

  const serviceEntries = Object.values(servicesService.state!.context.services);

  return (
    <select
      onChange={(e) => {
        onSelectSession(e.target.value);
      }}
      value={servicesService.state!.context.service}
      data-xviz="sessionSelect"
      title="Select a session"
    >
      {serviceEntries.map((serviceData) => {
        return (
          <option
            data-xviz="service-link"
            key={serviceData.sessionId}
            value={serviceData.sessionId}
          >
            {serviceData.id || serviceData.machine.id} ({serviceData.sessionId})
          </option>
        );
      })}
    </select>
  );
};

export function StateViz({
  state,
  onSelectSession,
}: {
  state: State<any, any>;
  onSelectSession?: (sessionId: string) => void;
}) {
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
      {onSelectSession && (
        <SessionSelectViz
          onSelectSession={(s) => {
            onSelectSession(s);
          }}
        />
      )}
      <div data-xviz="state-value">
        <JSONViz
          valueKey="state"
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
