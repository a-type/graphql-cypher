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
} from './graphql';
import {
  getGeneratedArgsFromDirectives,
  isCypherSkip,
  getCypherDirective,
  findCypherNodesDirectiveOnType,
  extractArgumentStringValue,
} from './directives';
import { getFieldDef } from 'graphql/execution/execute';
import { FieldMissingError } from './errors';
import { DEFAULT_DIRECTIVE_NAMES, IGNORED_FIELD_NAMES } from './constants';

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
  parentQuery: CypherQuery | undefined;
  config: ScanQueriesConfig;
  virtualParams: any;
};

const extractQueriesFromField = ({
  queries,
  parentType,
  field,
  variableValues,
  schema,
  path,
  fragments,
  parentQuery,
  config,
  virtualParams,
}: ExtractFromFieldParams): CypherQueryFieldMap => {
  const fieldName = field.name.value;

  if (IGNORED_FIELD_NAMES.includes(fieldName)) {
    return queries;
  }

  const skip = isCypherSkip(
    parentType,
    fieldName,
    config.directiveNames.cypherSkip
  );

  // add field name to active query if not @cypherSkip
  if (parentQuery && !skip) {
    parentQuery.fields.push(fieldName);
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
      if (virtualParams) {
        paramNames.push('virtual');
        params.virtual = virtualParams;
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
          returnsRelationship: cypherDirective.returnsRelationship,
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
      } else if (cypherDirective.kind === 'CypherRelationshipDirective') {
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

          const fieldType = extractObjectType(field.type);

          if (!fieldType) {
            throw new Error(
              "Cypher relationship directive points to type which is not Object type. The library doesn't support that yet."
            );
          }

          const nodeDirectives = findCypherNodesDirectiveOnType({
            schemaType: fieldType,
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
            getFieldTypeName(fieldType, nodeDirectives[0].fieldName);

          if (!nodeLabel) {
            throw new Error(
              `Cypher node on field "${fieldType.name}.${
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
      } else if (cypherDirective.kind === 'CypherLinkedNodesDirective') {
        const fieldTypeName = getFieldTypeName(parentType, fieldName);
        const label = cypherDirective.label || fieldTypeName;

        currentQuery = {
          ...baseQueryProperties,
          ...cypherDirective,
          kind: 'LinkedNodesCypherQuery',
          label,
          direction: cypherDirective.direction || 'OUT',
        };
      } else if (cypherDirective.kind === 'CypherComputedDirective') {
        currentQuery = {
          ...baseQueryProperties,
          kind: 'ComputedCypherQuery',
          value: cypherDirective.value,
        };
      } else {
        currentQuery = {
          ...baseQueryProperties,
          kind: 'VirtualCypherQuery',
        };
      }

      if (!currentQuery) {
        throw new Error(
          `Invalid state: failed to extract query from cypher directive (type: "${
            parentType.name
          }", field: "${fieldName}")`
        );
      }

      if (parentQuery) {
        parentQuery.fieldQueries[fieldName] = currentQuery;
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

  /**
   * This behavior enables Virtual queries to be used as 'root' queries. It essentially
   * skips them in the overall query structure evaluation. To summarize, a Virtual
   * query with no parent is also not allowed to have children. Child queries get
   * to start a 'fresh' query tree. During evaluation, these 'single' Virtual queries
   * will just return an empty object for their children to fill into.
   *
   * So, supposing your structure is like:
   * A [Virtual]
   * - B [Virtual]
   *   - D [Cypher]
   *     - F [Cypher]
   *   - E [Cypher]
   * - C [Cypher]
   *   - G [Cypher]
   *
   * We want to end up with a query plan like:
   * [
   *   A,
   *   B,
   *   [D, [F]],
   *   [C, [G]]
   * ]
   *
   * And a final structure of:
   *
   * {
   *  A: {
   *   B: {
   *    D: {
   *     F
   *    },
   *    E
   *   },
   *   C: {
   *    G
   *   }
   *  }
   * }
   */
  let propagatedQuery = currentQuery;
  if (
    propagatedQuery &&
    propagatedQuery.kind === 'VirtualCypherQuery' &&
    !parentQuery
  ) {
    // by resetting the propagated query, we ensure that children
    // will behave as if they have no parent and will generate their
    // own distinct subqueries to be run in parallel.
    propagatedQuery = undefined;
  }

  /**
   * Regardless of whether we propagate the parent virtual query, we
   * still want to propagate its parameters to the $virtual param.
   */
  const propagatedVirtualParams =
    currentQuery && currentQuery.kind === 'VirtualCypherQuery'
      ? { ...currentQuery.params.virtual, ...currentQuery.params.args }
      : undefined;

  return extractQueriesFromSelectionSet({
    selectionSet: field.selectionSet,
    queries,
    parentQuery: propagatedQuery,
    parentType: currentTypeAsObjectType,
    variableValues,
    schema,
    path,
    fragments,
    config,
    virtualParams: propagatedVirtualParams,
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
  parentQuery: CypherQuery | undefined;
  config: ScanQueriesConfig;
  virtualParams: any;
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
        parentQuery: undefined,
        config,
        virtualParams: undefined,
      }),
    {}
  );
};
