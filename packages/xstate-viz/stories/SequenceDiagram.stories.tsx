import React from "react";
import { toSCXMLEvent } from "xstate/lib/utils";
import {
  SCXMLSequenceEvent,
  SequenceDiagramViz,
} from "../src/SequenceDiagramViz";

export default {
  title: "Sequence Diagram",
};

const events: SCXMLSequenceEvent[] = [
  { ...toSCXMLEvent("first"), origin: "A", dest: "B", timestamp: Date.now() },
  { ...toSCXMLEvent("second"), origin: "B", dest: "C", timestamp: Date.now() },
  { ...toSCXMLEvent("third"), origin: "C", dest: "A", timestamp: Date.now() },
  { ...toSCXMLEvent("fourth"), origin: "A", dest: "A", timestamp: Date.now() },
  { ...toSCXMLEvent("first"), origin: "A", dest: "B", timestamp: Date.now() },
  { ...toSCXMLEvent("second"), origin: "B", dest: "C", timestamp: Date.now() },
  { ...toSCXMLEvent("third"), origin: "C", dest: "A", timestamp: Date.now() },
  { ...toSCXMLEvent("fourth"), origin: "A", dest: "A", timestamp: Date.now() },
  { ...toSCXMLEvent("first"), origin: "A", dest: "B", timestamp: Date.now() },
  { ...toSCXMLEvent("second"), origin: "B", dest: "C", timestamp: Date.now() },
  { ...toSCXMLEvent("third"), origin: "C", dest: "A", timestamp: Date.now() },
  { ...toSCXMLEvent("fourth"), origin: "A", dest: "A", timestamp: Date.now() },
  { ...toSCXMLEvent("first"), origin: "A", dest: "B", timestamp: Date.now() },
  { ...toSCXMLEvent("second"), origin: "B", dest: "C", timestamp: Date.now() },
  { ...toSCXMLEvent("third"), origin: "C", dest: "A", timestamp: Date.now() },
  { ...toSCXMLEvent("fourth"), origin: "A", dest: "A", timestamp: Date.now() },
  { ...toSCXMLEvent("first"), origin: "A", dest: "B", timestamp: Date.now() },
  { ...toSCXMLEvent("second"), origin: "B", dest: "C", timestamp: Date.now() },
  { ...toSCXMLEvent("third"), origin: "C", dest: "A", timestamp: Date.now() },
  { ...toSCXMLEvent("fourth"), origin: "A", dest: "A", timestamp: Date.now() },
  { ...toSCXMLEvent("first"), origin: "A", dest: "B", timestamp: Date.now() },
  { ...toSCXMLEvent("second"), origin: "B", dest: "C", timestamp: Date.now() },
  { ...toSCXMLEvent("third"), origin: "C", dest: "A", timestamp: Date.now() },
  { ...toSCXMLEvent("fourth"), origin: "A", dest: "A", timestamp: Date.now() },
];

export const SequenceDiagram = () => {
  return <SequenceDiagramViz events={events} />;
};
