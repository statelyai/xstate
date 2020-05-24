import * as React from 'react';
import { SCXML } from 'xstate';

export const EventRecordViz: React.FC<{
  event: SCXML.Event<any>;
}> = ({ event }) => {
  return (
    <div data-xviz="event-record">
      <div data-xviz="event-record-name">{event.name}</div>
      <pre data-xviz="event-record-data">
        {Object.keys(event.data).length === 1
          ? JSON.stringify(event.data)
          : JSON.stringify(event.data, null, 2)}
      </pre>
    </div>
  );
};

export const EventRecordsViz: React.FC<{
  events: Array<SCXML.Event<any>>;
}> = ({ events }) => {
  return (
    <div data-xviz="event-records">
      {events.map((event, i) => {
        return <EventRecordViz event={event} key={i} />;
      })}
    </div>
  );
};
