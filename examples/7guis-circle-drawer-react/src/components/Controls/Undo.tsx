import { CircleContext } from "@/machine";
import { Undo2 as UndoIcon } from "lucide-react";

function Undo() {
  const { send } = CircleContext.useActorRef();
  const { undos } = CircleContext.useSelector((state) => state.context);

  return (
    <button
      onClick={() => send({ type: "UNDO" })}
      disabled={undos.length === 0}
    >
      <div className="end-cap">
        <UndoIcon color="hsl(0 0% 95%)" />
      </div>
      <span>Undo {undos.length > 0 && undos.length}</span>
    </button>
  );
}

export default Undo;
