
import { createActorContext } from "@xstate/react";
import triviaMachine from "../machines/triviaMachine";

export const TriviaMachineContext = createActorContext(triviaMachine)