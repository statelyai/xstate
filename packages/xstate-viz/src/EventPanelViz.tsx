import * as React from "react";
import { EventObject, SCXML, State } from "xstate";
import Editor from "./Editor";
import { TimestampViz } from "./TimestampViz";
import { SessionIdViz } from "./ActorRefViz";
import { EventTypeViz } from "./EventViz";
import { JSONViz } from "./JSONViz";
import { SCXMLSequenceEvent } from "./SequenceViz";

export const EventLogsViz: React.FC<{ events: SCXMLSequenceEvent[] }> = ({
  events,
}) => {
  return (
    <table data-xviz="eventLogs">
      <thead>
        <tr>
          <th>Data</th>
          <th>Time</th>
        </tr>
      </thead>
      <tbody>
        {events.map((event, i) => {
          return (
            <tr key={i}>
              <td>
                <details>
                  <summary>{event.name}</summary>
                  <JSONViz value={event.data} valueKey="event" />
                </details>
              </td>
              <td>
                <TimestampViz time={event.timestamp}></TimestampViz>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};

export const EventLogViz: React.FC<{
  event: SCXMLSequenceEvent;
}> = ({ event }) => {
  return (
    <details data-xviz="eventLog">
      <summary data-xviz="eventLog-summary">
        <div data-xviz="eventLog-name">
          <EventTypeViz eventType={event.name} />
        </div>
        <time data-xviz="eventLog-timestamp">
          <TimestampViz time={event.timestamp} />
        </time>
        <div
          data-xviz="eventLog-trace"
          data-xviz-self={event.origin === event.dest || undefined}
        >
          <SessionIdViz sessionId={event.origin} />
          <SessionIdViz sessionId={event.dest} />
        </div>
      </summary>
      <div data-xviz="eventLog-data">
        <JSONViz value={event.data} valueKey="event" />
      </div>
    </details>
  );
};

const EventCreator: React.FC<{
  state: State<any, any>;
  onEvent: (eventData: EventObject) => void;
}> = ({ state, onEvent }) => {
  const [selectedEvent, setSelectedEvent] = React.useState("");
  const [code, setCode] = React.useState("{}");
  return (
    <div data-xviz="eventCreator">
      <select
        onChange={(e) => {
          setCode(`{\n\t"type":"${e.target.value}"\n}`);
        }}
      >
        <option value="">Select an event type</option>
        {state.nextEvents.map((nextEvent) => {
          return <option key={nextEvent}>{nextEvent}</option>;
        })}
      </select>
      <Editor
        value={code}
        onChange={(value) => setCode(value)}
        key={selectedEvent}
        controlled={true}
      />
      <button
        onClick={() => {
          onEvent(JSON.parse(code));
        }}
      >
        Send
      </button>
    </div>
  );
};

export const EventPanelViz: React.FC<{
  events: Array<SCXMLSequenceEvent>;
  state: State<any, any>;
  onEvent: (eventData: EventObject) => void;
}> = ({ events, state, onEvent }) => {
  return (
    <div data-xviz="eventPanel">
      <EventLogsViz events={events}></EventLogsViz>
      {/* <div data-xviz="eventLogs">
        {events.map((event, i) => {
          return <EventLogViz event={event} key={i} />;
        })}
      </div> */}
      <EventCreator state={state} onEvent={onEvent} />
    </div>
  );
};
