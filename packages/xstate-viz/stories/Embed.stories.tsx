import React, { useLayoutEffect, useState } from "react";
import { createMachine, assign } from "xstate";
import { inspect } from "@xstate/inspect";

import "../themes/dark.scss";
import { useMachine } from "@xstate/react";

export default {
  title: "Inspector Embed",
};

const simpleMachine = createMachine<{ count: number }>({
  id: "simple",
  initial: "inactive",
  context: {
    count: 0,
  },
  invoke: {
    src: createMachine({
      initial: "foo",
      states: { foo: {} },
    }),
  },
  states: {
    inactive: {
      on: { TOGGLE: "active" },
    },
    active: {
      entry: assign({ count: (ctx) => ctx.count + 1 }),
      on: { TOGGLE: "inactive" },
    },
  },
});

const Simple = () => {
  const [state, send] = useMachine(simpleMachine, { devTools: true });

  return (
    <div>
      <h2>{state.value}</h2>
      <button onClick={() => send("TOGGLE")}>Toggle</button>
    </div>
  );
};

export const SimpleInspector = () => {
  const [inspecting, setInspecting] = useState(false);
  useLayoutEffect(() => {
    const i = inspect({
      // url: 'https://embed.statecharts.io'
      url: "http://localhost:3000/inspect",
    });
    setInspecting(true);

    return () => {
      i.disconnect();
    };
  }, []);

  return (
    <>
      {inspecting && <Simple />}
      <hr></hr>
      <iframe
        data-xstate
        style={{
          height: "50vh",
          width: "100%",
        }}
      />
    </>
  );
};

export const PopupInspector = () => {
  const [inspecting, setInspecting] = useState(false);
  useLayoutEffect(() => {
    const i = inspect({
      // url: 'https://embed.statecharts.io'
      url: "http://localhost:3000/inspect",
      iframe: false,
    });
    setInspecting(true);

    return () => {
      i.disconnect();
    };
  }, []);

  return (
    <>
      {inspecting && <Simple />}
      <hr></hr>
      <iframe
        data-xstate
        style={{
          height: "50vh",
          width: "100%",
        }}
      />
    </>
  );
};
