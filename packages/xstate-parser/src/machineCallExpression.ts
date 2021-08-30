import * as t from '@babel/types';
import { StateNode } from './stateNode';
import { createParser, GetParserResult } from './utils';
import { MachineOptions } from './options';

export type TMachineCallExpression = GetParserResult<
  typeof MachineCallExpression
>;

export const MachineCallExpression = createParser({
  babelMatcher: t.isCallExpression,
  parseNode: (node, context) => {
    if (
      t.isMemberExpression(node.callee) &&
      t.isIdentifier(node.callee.property) &&
      ['createMachine', 'Machine'].includes(node.callee.property.name)
    ) {
      return {
        callee: node.callee,
        calleeName: node.callee.property.name,
        definition: StateNode.parse(node.arguments[0], context),
        options: MachineOptions.parse(node.arguments[1], context)
      };
    }

    if (
      t.isIdentifier(node.callee) &&
      ['createMachine', 'Machine'].includes(node.callee.name)
    ) {
      return {
        callee: node.callee,
        calleeName: node.callee.name,
        definition: StateNode.parse(node.arguments[0], context),
        options: MachineOptions.parse(node.arguments[1], context)
      };
    }
  }
});
