import * as t from '@babel/types';
import { BooleanLiteral } from './scalars';
import { MaybeTransitionArray } from './transitions';
import {
  createParser,
  isFunctionOrArrowFunctionExpression,
  maybeArrayOf,
  objectTypeWithKnownKeys,
  unionType
} from './utils';

interface InvokeNode {
  node: t.Node;
  value: string | (() => Promise<void>);
}

const InvokeIdStringLiteral = createParser({
  babelMatcher: t.isStringLiteral,
  parseNode: (node) => ({
    node,
    value: node.value
  })
});

const InvokeSrcStringLiteral = createParser({
  babelMatcher: t.isStringLiteral,
  parseNode: (node): InvokeNode => ({
    node,
    value: node.value
  })
});

const InvokeSrcFunctionExpression = createParser({
  babelMatcher: isFunctionOrArrowFunctionExpression,
  parseNode: (node): InvokeNode => ({
    value: async function src() {},
    node
  })
});

const InvokeSrcNode = createParser({
  babelMatcher: t.isNode,
  parseNode: (node): InvokeNode => ({
    value: 'anonymous',
    node
  })
});

const InvokeSrc = unionType([
  InvokeSrcStringLiteral,
  InvokeSrcFunctionExpression,
  InvokeSrcNode
]);

const InvokeConfigObject = objectTypeWithKnownKeys({
  id: InvokeIdStringLiteral,
  src: InvokeSrc,
  onDone: MaybeTransitionArray,
  onError: MaybeTransitionArray,
  autoForward: BooleanLiteral,
  forward: BooleanLiteral
});

export const Invoke = maybeArrayOf(InvokeConfigObject);
