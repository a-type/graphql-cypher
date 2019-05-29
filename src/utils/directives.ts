import { GraphQLObjectType, ArgumentNode } from 'graphql';
import { CypherConditionalStatement } from '../types';
import uuid from 'uuid';
import { valueNodeToValue } from './graphql';

export const extractArgumentStringValue = (
  argument?: ArgumentNode | null
): string | null => {
  if (!argument) {
    return null;
  }

  const value = argument.value;
  if (value.kind !== 'StringValue') {
    return null;
  }
  return value.value;
};

export const getCypherStatementsFromDirective = (
  schemaType: GraphQLObjectType,
  fieldName: string,
  directiveName: string = 'cypher'
): CypherConditionalStatement[] => {
  const field = schemaType.getFields()[fieldName];
  if (!field || !field.astNode) {
    return [];
  }

  const cypherDirective = field.astNode.directives
    ? field.astNode.directives.find(
        directive => directiveName === directive.name.value
      )
    : null;

  if (!cypherDirective || !cypherDirective.arguments) {
    return [];
  }

  const statementArg = cypherDirective.arguments.find(
    arg => arg.name.value === 'statement'
  );
  if (statementArg) {
    const statement = extractArgumentStringValue(statementArg);
    if (!statement) {
      throw new Error(`@cypher directive 'statement' arg must be a string.`);
    }
    return [
      {
        statement: statement.trim(),
      },
    ];
  }

  const statementsArg = cypherDirective.arguments.find(
    arg => arg.name.value === 'statements'
  );

  if (!statementsArg) {
    throw new Error(
      `@cypher directive on '${
        field.name
      }' must specify either 'statement' or 'statements' argument`
    );
  }

  return valueNodeToValue(statementsArg.value, {}).map(item => ({
    ...item,
    statement: item.statement.trim(),
  }));
};

export const isCypherSkip = (
  schemaType: GraphQLObjectType,
  fieldName: string,
  directiveName: string = 'cypherSkip'
) => {
  const field = schemaType.getFields()[fieldName];
  if (!field || !field.astNode) {
    return false;
  }

  return (
    field.astNode.directives &&
    field.astNode.directives.some(
      directive => directive.name.value === directiveName
    )
  );
};

export const getGeneratedArgsFromDirectives = (
  schemaType: GraphQLObjectType,
  fieldName: string,
  generateIdDirectiveName: string = 'generateId'
): { [name: string]: any } | null => {
  const field = schemaType.getFields()[fieldName];
  if (!field || !field.astNode) {
    return [];
  }

  const generateIdDirective = field.astNode.directives
    ? field.astNode.directives.find(
        directive => directive.name.value === generateIdDirectiveName
      )
    : null;

  if (!generateIdDirective) {
    return null;
  }

  const generatedIdArgNameArgument =
    generateIdDirective.arguments &&
    generateIdDirective.arguments.find(arg => arg.name.value === 'argName');

  const generatedIdArgName =
    (generatedIdArgNameArgument &&
      extractArgumentStringValue(generatedIdArgNameArgument)) ||
    'id';

  return {
    [generatedIdArgName]: uuid(),
  };
};
