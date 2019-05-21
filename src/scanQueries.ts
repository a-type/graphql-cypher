import {
  CypherQueryFieldMap,
  CypherConditionalStatement,
  CypherQuery,
} from 'types';
import {
  GraphQLResolveInfo,
  GraphQLObjectType,
  FieldNode,
  FragmentDefinitionNode,
  GraphQLSchema,
} from 'graphql';
import {
  getCypherStatementsFromDirective,
  argFieldsToValues,
  selectionSetToFieldNames,
  extractObjectType,
} from 'utils';
import { path } from 'ramda';
import { getFieldDef } from 'graphql/execution/execute';

type ExtractSelectionsParams = {
  queries: CypherQueryFieldMap;
  parentType: GraphQLObjectType;
  field: FieldNode;
  variableValues: { [name: string]: any };
  schema: GraphQLSchema;
  path: string[];
  fragments: { [key: string]: FragmentDefinitionNode };
  activeQuery: CypherQuery | undefined;
};

const getMatchingConditionalCypher = (
  cypherDirectives: CypherConditionalStatement[],
  args: { [key: string]: any },
  fieldName: string
): CypherConditionalStatement => {
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
  parentType,
  field,
  variableValues,
  schema,
  path,
  fragments,
  activeQuery,
}: ExtractSelectionsParams): CypherQueryFieldMap => {
  const cypherDirectives = getCypherStatementsFromDirective(
    parentType,
    field.name.value
  );

  let currentQuery: CypherQuery;

  // any field with a @cypher directive has something to add to the query
  if (cypherDirectives.length) {
    const argValues = argFieldsToValues(
      {},
      field.arguments || [],
      variableValues
    );
    // use arguments to determine the matching cypher statement.
    const { statement: cypher } = getMatchingConditionalCypher(
      cypherDirectives,
      argValues,
      field.name.value
    );

    currentQuery = {
      cypher,
      fields: field.selectionSet
        ? selectionSetToFieldNames([], field.selectionSet, fragments)
        : [],
      fieldQueries: {},
    };

    if (activeQuery) {
      activeQuery.fieldQueries[field.name.value] = currentQuery;
    } else {
      queries.set(path, currentQuery);
    }
  }

  if (!field.selectionSet) {
    return queries;
  }

  return field.selectionSet.selections.reduce((reducedQueries, selection) => {
    if (selection.kind === 'Field') {
      const selectedFieldName = selection.name.value;
      const selectionFieldDef = getFieldDef(
        schema,
        parentType,
        selectedFieldName
      );
      if (!selectionFieldDef) {
        throw new Error(
          `Something is wrong. The selected field ${selectedFieldName} on type ${
            parentType.name
          } is not in the schema.`
        );
      }
      const selectionParentType = extractObjectType(selectionFieldDef.type);

      if (selectionParentType) {
        return extractQueriesFromSelections({
          queries: reducedQueries,
          activeQuery: currentQuery,
          fragments,
          variableValues,
          schema,
          path: [...path, selectedFieldName],
          parentType: selectionParentType,
          field: selection,
        });
      }
    }

    return queries;
  }, queries);
};

export const extractQueriesFromOperation = (info: GraphQLResolveInfo) => {
  const schema = info.schema;
  const rootType = info.parentType;
  const variableValues = info.variableValues;
  const fragments = info.fragments;

  const fields = info.fieldNodes;

  return fields.reduce(
    (queries, field) =>
      extractQueriesFromSelections({
        queries,
        parentType: rootType,
        field,
        variableValues,
        fragments,
        path: [rootType.name, field.name.value],
        schema,
        activeQuery: undefined,
      }),
    new Map()
  );
};
