import { toTrie } from "./utils"; // TODO: change to utils
import { StateValue } from "./types";

export default function matchesState(
  parentStateId: StateValue,
  childStateId: StateValue
): boolean {
  const parentStateValue = toTrie(parentStateId);
  const childStateValue = toTrie(childStateId);

  if (typeof childStateValue === "string") {
    if (typeof parentStateValue === "string") {
      return childStateValue === parentStateValue;
    }

    return childStateValue in parentStateValue;
  }

  if (typeof parentStateValue === "string") {
    return parentStateValue in childStateValue;
  }

  return Object.keys(parentStateValue).every(key => {
    if (!(key in childStateValue)) {
      return false;
    }

    return matchesState(parentStateValue[key], childStateValue[key]);
  });
}
