import {
  CypherQueryFieldMap,
  CypherConditionalStatement,
  CustomCypherQuery,
  DirectiveNames,
  CustomCypherParams,
} from './types';
import {
  GraphQLResolveInfo,
  GraphQLObjectType,
  FieldNode,
  FragmentDefinitionNode,
  GraphQLSchema,
  SelectionSetNode,
} from 'graphql';
import {
  getCypherStatementsFromDirective,
  extractObjectType,
  isCypherSkip,
  getNameOrAlias,
  getArgumentsPlusDefaults,
  isListOrWrappedListType,
  getGeneratedArgsFromDirectives,
} from './utils';
import { path } from 'ramda';
import { getFieldDef } from 'graphql/execution/execute';

export type ScanQueriesConfig = {
  directiveNames: DirectiveNames;
};

const getMatchingConditionalCypher = (
  cypherDirectives: CypherConditionalStatement[],
  args: { [key: string]: any },
  fieldName: string,
  directiveName: string = 'cypher'
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

    const pathValue = path(pathSegments, { args });

    if (!!pathValue) {
      return directive;
    }
  }

  throw new Error(
    `No @${directiveName} directive matched on field ${fieldName}. Always supply a directive without a condition!`
  );
};

type ExtractFromFieldParams = {
  queries: CypherQueryFieldMap;
  parentType: GraphQLObjectType;
  field: FieldNode;
  variableValues: { [name: string]: any };
  schema: GraphQLSchema;
  path: string[];
  fragments: { [key: string]: FragmentDefinitionNode };
  activeQuery: CustomCypherQuery | undefined;
  config: ScanQueriesConfig;
};

const extractQueriesFromField = ({
  queries,
  parentType,
  field,
  variableValues,
  schema,
  path,
  fragments,
  activeQuery,
  config,
}: ExtractFromFieldParams): CypherQueryFieldMap => {
  const fieldName = field.name.value;

  // add field name to active query if not @cypherSkip
  if (
    activeQuery &&
    !isCypherSkip(parentType, fieldName, config.directiveNames.cypherSkip)
  ) {
    activeQuery.fields.push(fieldName);
  }

  const schemaFieldDef = getFieldDef(schema, parentType, fieldName);
  if (!schemaFieldDef) {
    throw new Error(
      `Invalid state, there's no field definition for field "${fieldName}" on type "${
        parentType.name
      }"`
    );
  }

  const cypherDirectives = getCypherStatementsFromDirective(
    parentType,
    fieldName,
    config.directiveNames.cypher
  );

  let currentQuery: CustomCypherQuery | undefined = undefined;

  // any field with a @cypher directive has something to add to the query
  if (cypherDirectives.length) {
    const argValues = getArgumentsPlusDefaults(
      parentType.name,
      field,
      schema,
      variableValues
    );

    const generatedArgs = getGeneratedArgsFromDirectives(
      parentType,
      fieldName,
      config.directiveNames.generateId
    );

    // use arguments to determine the matching cypher statement.
    const { statement: cypher } = getMatchingConditionalCypher(
      cypherDirectives,
      argValues,
      fieldName,
      config.directiveNames.cypher
    );

    const paramNames: string[] = [];
    const params: CustomCypherParams = {};
    if (Object.keys(argValues).length) {
      paramNames.push('args');
      params.args = argValues;
    }
    if (generatedArgs) {
      paramNames.push('generated');
      params.generated = generatedArgs;
    }

    currentQuery = {
      cypher,
      returnsList: isListOrWrappedListType(schemaFieldDef.type),
      fields: [],
      paramNames: paramNames,
      params,
      fieldQueries: {},
    } as CustomCypherQuery;

    if (activeQuery) {
      activeQuery.fieldQueries[fieldName] = currentQuery;
    } else {
      queries[path.join(',')] = currentQuery;
    }
  }

  if (!field.selectionSet) {
    return queries;
  }

  const currentTypeAsObjectType = extractObjectType(schemaFieldDef.type);

  if (!currentTypeAsObjectType) {
    return queries;
  }

  return extractQueriesFromSelectionSet({
    selectionSet: field.selectionSet,
    queries,
    activeQuery: currentQuery,
    parentType: currentTypeAsObjectType,
    variableValues,
    schema,
    path,
    fragments,
    config,
  });
};

type ExtractFromSelectionSetParams = {
  queries: CypherQueryFieldMap;
  parentType: GraphQLObjectType;
  selectionSet: SelectionSetNode;
  variableValues: { [name: string]: any };
  schema: GraphQLSchema;
  path: string[];
  fragments: { [key: string]: FragmentDefinitionNode };
  activeQuery: CustomCypherQuery | undefined;
  config: ScanQueriesConfig;
};

const extractQueriesFromSelectionSet = ({
  selectionSet,
  queries,
  path,
  ...rest
}: ExtractFromSelectionSetParams) =>
  selectionSet.selections.reduce((reducedQueries, selection) => {
    if (selection.kind === 'Field') {
      return extractQueriesFromField({
        queries: reducedQueries,
        field: selection,
        path: [...path, getNameOrAlias(selection)],
        ...rest,
      });
    } else if (selection.kind === 'InlineFragment') {
      return extractQueriesFromSelectionSet({
        selectionSet: selection.selectionSet,
        queries: reducedQueries,
        path,
        ...rest,
      });
    } else {
      const fragment = rest.fragments[selection.name.value];
      return extractQueriesFromSelectionSet({
        selectionSet: fragment.selectionSet,
        queries: reducedQueries,
        path,
        ...rest,
      });
    }
  }, queries);

export const extractCypherQueriesFromOperation = (
  info: GraphQLResolveInfo,
  config: {
    directiveNames: DirectiveNames;
  } = {
    directiveNames: {
      cypher: 'cypher',
      cypherSkip: 'cypherSkip',
      generateId: 'generateId',
    },
  }
): CypherQueryFieldMap => {
  const schema = info.schema;
  const rootType = info.parentType;
  const variableValues = info.variableValues;
  const fragments = info.fragments;

  const fields = info.fieldNodes;

  return fields.reduce(
    (queries, field) =>
      extractQueriesFromField({
        queries,
        parentType: rootType,
        field,
        variableValues,
        fragments,
        path: [getNameOrAlias(field)],
        schema,
        activeQuery: undefined,
        config,
      }),
    {}
  );
};
