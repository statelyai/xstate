import Size from "./Size";
import Color from "./Color";
import Redo from "./Redo";
import Undo from "./Undo";

export function Controls() {
  return (
    <div className="flex gap8">
      <Size />
      <Color />
    </div>
  );
}

export { Undo, Redo };
