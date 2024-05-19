import { CircleContext, DEFAULT_CIRCLE_RADIUS } from "@/machine";
import { getCircleById } from "@/utils";

function Size() {
  const { send } = CircleContext.useActorRef();
  const { circles, selectedCircleId } = CircleContext.useSelector(
    (state) => state.context
  );
  const selectedCircle = getCircleById(circles, selectedCircleId);

  function startEdit() {
    send({
      type: "START_EDIT",
    });
  }

  function edit(e: React.ChangeEvent<HTMLInputElement>): void {
    send({
      type: "EDIT",
      setting: "radius",
      value: parseInt(e.currentTarget.value),
    });
  }

  function endEdit() {
    send({
      type: "END_EDIT",
    });
  }

  return (
    <div className="size">
      <div className="end-cap" style={{ width: "6ch" }}>
        {(selectedCircle?.radius || DEFAULT_CIRCLE_RADIUS) * 2}px
      </div>
      <label className="visually-hidden" htmlFor="size">
        Change Size
      </label>
      <input
        id="size"
        type="range"
        min="10"
        max="125"
        disabled={!selectedCircle}
        value={selectedCircle?.radius || DEFAULT_CIRCLE_RADIUS}
        onChange={edit}
        onChangeCapture={startEdit}
        onPointerUp={endEdit}
        onLostPointerCapture={endEdit}
      />
    </div>
  );
}

export default Size;
