import {
  CypherQueryFieldMap,
  ExtractQueryTraversalInfo,
  CypherConditionalStatement,
} from 'types';
import {
  GraphQLResolveInfo,
  GraphQLObjectType,
  SelectionSetNode,
  FieldNode,
  ArgumentNode,
} from 'graphql';
import { getCypherStatementsFromDirective, argFieldsToValues } from 'utils';
import { path } from 'ramda';

type ExtractSelectionsParams = {
  queries: CypherQueryFieldMap;
  schemaType: GraphQLObjectType;
  fieldName: string;
  args: readonly ArgumentNode[];
  selectionSet: SelectionSetNode;
  variableValues: { [name: string]: any };
  info: ExtractQueryTraversalInfo;
};

const getMatchingCypherDirective = (
  cypherDirectives: CypherConditionalStatement[],
  args: { [key: string]: any },
  fieldName: string
) => {
  for (let directive of cypherDirectives) {
    if (!directive.when) {
      return directive;
    }

    const pathSegments = directive.when
      .replace('$', '')
      .split('.')
      .map(segment => {
        if (segment.startsWith('[') && segment.endsWith(']')) {
          return parseInt(segment.replace('[', '').replace(']', ''), 10);
        }
        return segment;
      });

    const pathValue = path(pathSegments, args);

    if (!!pathValue) {
      return directive;
    }
  }

  throw new Error(
    `No @cypher directive matched on field ${fieldName}. Always supply a directive without a condition!`
  );
};

const extractQueriesFromSelections = ({
  queries,
  schemaType,
  fieldName,
  args,
  variableValues,
  selectionSet,
  info,
}: ExtractSelectionsParams): CypherQueryFieldMap => {
  const cypherDirectives = getCypherStatementsFromDirective(
    schemaType,
    fieldName
  );
  const argValues = argFieldsToValues({}, args, variableValues);
  const matchingCypherDirective = getMatchingCypherDirective(
    cypherDirectives,
    argValues,
    fieldName
  );
  const cypher = matchingCypherDirective.statement;

  return queries;
};

export const extractQueriesFromOperation = (info: GraphQLResolveInfo) => {
  const schema = info.schema;
  const rootType = info.parentType;
  const fieldName = info.fieldName;
  const args = info.fieldNodes[0].arguments;
  const selectionSet = info.operation.selectionSet;
  const variableValues = info.variableValues;

  return extractQueriesFromSelections({
    queries: new Map(),
    schemaType: rootType,
    fieldName,
    args: args || [],
    selectionSet,
    variableValues,
    info: {
      path: [rootType.name, fieldName],
      schema,
    },
  });
};
