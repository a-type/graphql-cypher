import {
  CypherQueryFieldMap,
  DirectiveNames,
  CustomCypherParams,
  CypherQuery,
} from './types';
import {
  GraphQLResolveInfo,
  GraphQLObjectType,
  FieldNode,
  FragmentDefinitionNode,
  GraphQLSchema,
  SelectionSetNode,
  isObjectType,
} from 'graphql';
import {
  extractObjectType,
  getNameOrAlias,
  getArgumentsPlusDefaults,
  isListOrWrappedListType,
  getFieldTypeName,
} from './utils/graphql';
import {
  getGeneratedArgsFromDirectives,
  isCypherSkip,
  getCypherDirective,
  findCypherNodesDirectiveOnType,
  extractArgumentStringValue,
} from './utils/directives';
import { getFieldDef } from 'graphql/execution/execute';
import { FieldMissingError } from './errors';
import { DEFAULT_DIRECTIVE_NAMES } from './constants';

export type ScanQueriesConfig = {
  directiveNames: DirectiveNames;
};

type ExtractFromFieldParams = {
  queries: CypherQueryFieldMap;
  parentType: GraphQLObjectType;
  field: FieldNode;
  variableValues: { [name: string]: any };
  schema: GraphQLSchema;
  path: string[];
  fragments: { [key: string]: FragmentDefinitionNode };
  activeQuery: CypherQuery | undefined;
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
  const skip = isCypherSkip(
    parentType,
    fieldName,
    config.directiveNames.cypherSkip
  );

  // add field name to active query if not @cypherSkip
  if (activeQuery && !skip) {
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

  let currentQuery: CypherQuery | undefined = undefined;

  if (!skip) {
    const argValues = getArgumentsPlusDefaults(
      parentType.name,
      field,
      schema,
      variableValues
    );

    const cypherDirective = getCypherDirective({
      schemaType: parentType,
      fieldName,
      directiveNames: config.directiveNames,
      args: argValues,
    });

    // any field with a @cypher directive has something to add to the query
    if (cypherDirective) {
      const generatedArgs = getGeneratedArgsFromDirectives(
        parentType,
        fieldName,
        config.directiveNames.generateId
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

      const baseQueryProperties = {
        returnsList: isListOrWrappedListType(schemaFieldDef.type),
        fields: [],
        paramNames: paramNames,
        params,
        fieldQueries: {},
      };

      if (cypherDirective.kind === 'CypherCustomDirective') {
        currentQuery = {
          ...baseQueryProperties,
          kind: 'CustomCypherQuery',
          cypher: cypherDirective.cypher,
        };
      } else if (cypherDirective.kind === 'CypherBuilderDirective') {
        currentQuery = {
          ...baseQueryProperties,
          ...cypherDirective,
          kind: 'BuilderCypherQuery',
        };
      } else if (cypherDirective.kind === 'CypherNodeDirective') {
        const fieldTypeName = getFieldTypeName(parentType, fieldName);
        const label = cypherDirective.label || fieldTypeName;

        if (!label) {
          throw new Error(
            `Cypher node on field "${
              parentType.name
            }.${fieldName}" has no label specified and none could be inferred from return type`
          );
        }

        currentQuery = {
          ...baseQueryProperties,
          ...cypherDirective,
          label,
          kind: 'NodeCypherQuery',
        };
      } else {
        if (cypherDirective.nodeLabel) {
          currentQuery = {
            ...baseQueryProperties,
            ...cypherDirective,
            nodeLabel: cypherDirective.nodeLabel,
            kind: 'RelationshipCypherQuery',
          };
        } else {
          const field = parentType.getFields()[fieldName];
          if (!field) {
            throw new FieldMissingError(parentType.name, fieldName);
          }

          if (!isObjectType(field.type)) {
            throw new Error(
              "Cypher relationship directive points to type which is not Object type. The library doesn't support that yet."
            );
          }

          const nodeDirectives = findCypherNodesDirectiveOnType({
            schemaType: field.type,
            directiveNames: config.directiveNames,
          });

          if (nodeDirectives.length === 0) {
            throw new Error(
              `Unsupported: Cypher Relationship directive points to type which does not have a Cypher Node field.`
            );
          } else if (nodeDirectives.length > 1) {
            throw new Error(
              `Unsupported: multiple @${
                config.directiveNames.cypherNode
              } directives are not supported on a type which represents a Relationship.`
            );
          }

          const nodeLabel =
            extractArgumentStringValue(nodeDirectives[0].directive, 'label') ||
            getFieldTypeName(field.type, nodeDirectives[0].fieldName);

          if (!nodeLabel) {
            throw new Error(
              `Cypher node on field "${field.type.name}.${
                nodeDirectives[0].fieldName
              }" has no label specified and none could be inferred from return type`
            );
          }

          currentQuery = {
            ...baseQueryProperties,
            ...cypherDirective,
            nodeLabel,
            kind: 'RelationshipCypherQuery',
          };
        }
      }

      if (!currentQuery) {
        throw new Error(
          `Invalid state: failed to extract query from cypher directive (type: "${
            parentType.name
          }", field: "${fieldName}")`
        );
      }

      if (activeQuery) {
        activeQuery.fieldQueries[fieldName] = currentQuery;
      } else {
        queries[path.join(',')] = currentQuery;
      }
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
  activeQuery: CypherQuery | undefined;
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
    directiveNames: DEFAULT_DIRECTIVE_NAMES,
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
