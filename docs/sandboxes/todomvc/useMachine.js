import { useState, useMemo, useEffect } from "react";
import { interpret } from "xstate/lib/interpreter";

export function useMachine(machine, options = {}) {
  const [current, setCurrent] = useState(machine.initialState);
  const service = useMemo(
    () =>
      interpret(machine)
        .onTransition(state => {
          options.log && console.log("CONTEXT:", state.context);
          setCurrent(state);
        })
        .onEvent(e => options.log && console.log("EVENT:", e))
        .start(),
    []
  );

  useEffect(() => {
    return () => service.stop();
  }, []);

  return [current, service.send];
}
