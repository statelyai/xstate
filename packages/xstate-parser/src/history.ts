import * as t from '@babel/types';
import { createParser, unionType } from './utils';

interface HistoryNode {
  node: t.Node;
  value: 'shallow' | 'deep' | boolean;
}

const HistoryAsString = createParser({
  babelMatcher: t.isStringLiteral,
  parseNode: (node): HistoryNode => {
    return {
      node,
      value: node.value as HistoryNode['value']
    };
  }
});

const HistoryAsBoolean = createParser({
  babelMatcher: t.isBooleanLiteral,
  parseNode: (node): HistoryNode => {
    return {
      node,
      value: node.value
    };
  }
});

export const History = unionType([HistoryAsString, HistoryAsBoolean]);
