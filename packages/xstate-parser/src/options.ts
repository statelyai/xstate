import { AnyNode, BooleanLiteral } from './scalars';
import {
  identifierReferencingVariableDeclaration,
  objectOf,
  objectTypeWithKnownKeys,
  unionType
} from './utils';

const MachineOptionsObject = objectTypeWithKnownKeys({
  actions: objectOf(AnyNode),
  services: objectOf(AnyNode),
  guards: objectOf(AnyNode),
  delays: objectOf(AnyNode),
  devTools: BooleanLiteral
});

export const MachineOptions = unionType([
  MachineOptionsObject,
  identifierReferencingVariableDeclaration(MachineOptionsObject)
]);
