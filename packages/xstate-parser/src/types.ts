import * as t from '@babel/types';
import { MachineParseResult } from './MachineParseResult';

export type Location = t.SourceLocation | null;

export interface StringLiteralNode {
  value: string;
  node: t.Node;
}

export interface ParserContext {
  file: t.File;
}

export interface Parser<T extends t.Node = any, Result = any> {
  parse: (node: t.Node, context: ParserContext) => Result | undefined;
  matches: (node: T) => boolean;
}

export interface AnyParser<Result> {
  parse: (node: any, context: ParserContext) => Result | undefined;
  matches: (node: any) => boolean;
}

export interface ParseResult {
  machines: MachineParseResult[];
}
