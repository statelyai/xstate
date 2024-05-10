import { CircleContext } from "@/machine";
import { Redo2 as RedoIcon } from "lucide-react";

function Redo() {
  const { send } = CircleContext.useActorRef();
  const { redos } = CircleContext.useSelector((state) => state.context);

  return (
    <button
      onClick={() => send({ type: "REDO" })}
      disabled={redos.length === 0}
    >
      <span>Redo {redos.length > 0 && redos.length}</span>
      <div className="end-cap right">
        <RedoIcon color="var(--white)" />
      </div>
    </button>
  );
}

export default Redo;
