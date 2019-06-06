import {
  BuilderCypherQuery,
  CypherQuery,
  NodeCypherQuery,
  RelationshipCypherQuery,
  CustomCypherQuery,
  VirtualCypherQuery,
  LinkedNodesCypherQuery,
  ComputedCypherQuery,
} from '../types';
import {
  buildNode,
  buildRelationship,
  buildMatch,
  buildOptionalMatch,
  buildCreate,
  buildMerge,
  buildDelete,
  buildSet,
  buildDetachDelete,
  buildRemove,
  buildPhrases,
  buildReturn,
  buildFilters,
  buildWith,
  buildMultiValueYieldMapper,
  safeVar,
  escapeQuotes,
  createParamNamespacer,
  getBindings,
  buildWhere,
} from './language';
import { FIELD_PARAM_PREFIX } from './constants';

const evaluateParamValue = <T>(query: CypherQuery, paramName: string) => {
  const path = paramName.replace('$', '').split('.');
  const value = path.reduce<T>(
    (obj, prop) => (obj ? obj[prop] : null),
    query.params as any
  );
  return value || null;
};

const buildRelationshipField = ({
  fieldName,
  query,
  parentName,
  namespace,
  ...rest
}: {
  fieldName: string;
  query: RelationshipCypherQuery;
  parentName: string;
  namespace: string;
  hasContext: boolean;
}) => {
  const namespacedName = `${namespace}_${fieldName}`;
  const nodeBindingName = `${namespacedName}_node`;
  const namespaceParams = createParamNamespacer(namespacedName);

  return [
    `${fieldName}: `,
    query.returnsList ? '' : 'head(',
    '[',
    buildNode({ binding: parentName }),
    buildRelationship({
      label: query.relationshipType,
      binding: namespacedName,
      direction: query.direction,
    }),
    buildNode({ binding: nodeBindingName, label: query.nodeLabel }),
    // rename placeholders to binding names
    query.where
      ? ' ' +
        buildWhere(
          namespaceParams(
            query.where
              .replace(/relationship/g, namespacedName)
              .replace(/node/g, nodeBindingName)
          )
        )
      : '',
    ' | ',
    `${namespacedName} `,
    buildFields({
      parentName: namespacedName,
      query,
      parentWasRelationship: true,
      namespace: namespacedName,
      ...rest,
    }),
    ']',
  ].join('');
};

const buildNodeField = ({
  fieldName,
  query,
  parentName,
  namespace,
  parentWasRelationship,
  ...rest
}: {
  fieldName: string;
  query: NodeCypherQuery;
  parentName: string;
  namespace: string;
  parentWasRelationship: boolean;
  hasContext: boolean;
}) => {
  const namespacedName = `${namespace}_${fieldName}`;
  const namespaceParams = createParamNamespacer(namespacedName);
  const relationshipBindingName = parentWasRelationship
    ? parentName
    : `${namespacedName}_relationship`;

  return [
    `${fieldName}: `,
    query.returnsList ? '' : 'head(',
    '[',
    buildNode({ binding: parentWasRelationship ? undefined : parentName }),
    buildRelationship({
      binding: relationshipBindingName,
      label: query.relationship,
      direction: query.direction,
    }),
    buildNode({ binding: namespacedName, label: query.label }),
    // rename 'node' placeholder to binding name
    query.where
      ? ' ' +
        buildWhere(
          namespaceParams(
            query.where
              .replace(/node/g, namespacedName)
              .replace(/relationship/g, relationshipBindingName)
          )
        )
      : '',
    ' | ',
    `${namespacedName} `,
    buildFields({
      parentName: namespacedName,
      query,
      parentWasRelationship: false,
      namespace: namespacedName,
      ...rest,
    }),
    ']',
    query.returnsList ? '' : ')',
  ].join('');
};

const buildVirtualField = ({
  fieldName,
  query,
  namespace,
  parentName,
  ...rest
}: {
  fieldName: string;
  query: VirtualCypherQuery;
  namespace: string;
  parentName: string;
  hasContext: boolean;
}) => {
  return [
    `${fieldName}: `,
    buildFields({
      // parentName is transparently copied through
      parentName,
      query,
      parentWasRelationship: false,
      // namespace is updated, since the virtual query will still
      // affect the overall query structure
      namespace: `${namespace}_${fieldName}`,
      ...rest,
    }),
  ].join('');
};

const buildComputedField = ({
  fieldName,
  query,
  namespace,
  parentName,
  ...rest
}: {
  fieldName: string;
  query: ComputedCypherQuery;
  namespace: string;
  parentName: string;
  hasContext: boolean;
}) => {
  const namespacedName = `${namespace}_${fieldName}`;
  const namespaceParams = createParamNamespacer(namespacedName);

  return [
    `${fieldName}:`,
    namespaceParams(query.value.replace(/parent/g, parentName)),
    // I'm not really sure how fields would work, but see no reason to force
    // them to be omitted here.
    buildFields({
      parentName: namespacedName,
      query,
      parentWasRelationship: false,
      namespace: namespacedName,
      ...rest,
    }),
  ].join(' ');
};

const buildLinkedNodesField = ({
  fieldName,
  query,
  namespace,
  parentName,
  parentWasRelationship,
  ...rest
}: {
  fieldName: string;
  query: LinkedNodesCypherQuery;
  namespace: string;
  parentName: string;
  parentWasRelationship: boolean;
  hasContext: boolean;
}) => {
  if (parentWasRelationship) {
    throw new Error(
      'Invalid: Linked Nodes directive cannot be used if its parent returns a relationship.'
    );
  }

  const namespacedName = `${namespace}_${fieldName}`;
  const namespaceParams = createParamNamespacer(namespacedName);

  const skip = query.skip
    ? evaluateParamValue<number>(query, query.skip)
    : null;
  const limit = query.limit
    ? evaluateParamValue<number>(query, query.limit)
    : null;

  const sliceEnd = limit !== null ? (skip || 0) + limit : null;

  return [
    `${fieldName}: `,
    query.returnsList ? '' : 'head(',
    '[',
    buildNode({ binding: parentName }),
    buildRelationship({
      label: query.relationship,
      direction: query.direction,
      variableLength: true,
      sliceStart: skip,
      sliceEnd,
    }),
    buildNode({ binding: namespacedName, label: query.label }),
    // rename 'node' placeholder to binding name
    query.where
      ? ' ' +
        buildWhere(
          namespaceParams(query.where.replace(/node/g, namespacedName))
        )
      : '',
    ' | ',
    `${namespacedName} `,
    buildFields({
      parentName: namespacedName,
      query,
      parentWasRelationship: false,
      namespace: namespacedName,
      ...rest,
    }),
    ']',
    query.returnsList ? '' : ')',
  ].join('');
};

/**
 * Formats params for an apoc subquery statement:
 * bar: $bar, baz: $baz, parent: parentVar
 * Parent is special, it gets added if a parentName is passed in.
 */
const buildCustomSubqueryParams = ({
  params,
  fieldName,
  parentName,
  hasContext,
}: {
  params: string[];
  fieldName: string;
  parentName?: string;
  hasContext: boolean;
}): string => {
  const paramTuples: [string, string][] = params.map(key => [
    key,
    `$${FIELD_PARAM_PREFIX}${fieldName}.${key}`,
  ]);
  if (parentName) {
    paramTuples.push(['parent', parentName]);
  }
  if (hasContext) {
    paramTuples.push(['context', '$context']);
  }

  return paramTuples.map(([name, value]) => `${name}: ${value}`).join(', ');
};

const buildCustomSubqueryClause = ({
  query,
  fieldName,
  parentName,
  hasContext,
}: {
  query: CustomCypherQuery;
  fieldName: string;
  parentName?: string;
  hasContext: boolean;
}): string => {
  const apocFn =
    'apoc.cypher.runFirstColumn' + (query.returnsList ? 'Many' : 'Single');

  return [
    `${apocFn}(`,
    `"WITH $parent as parent `,
    escapeQuotes(query.cypher),
    `", {`,
    buildCustomSubqueryParams({
      params: query.paramNames,
      fieldName,
      parentName,
      hasContext,
    }),
    `})`,
  ].join('');
};

const buildCustomField = ({
  fieldName,
  parentName,
  query,
  namespace,
  hasContext,
}: {
  fieldName: string;
  parentName: string;
  query: CustomCypherQuery;
  namespace: string;
  hasContext: boolean;
}) => {
  const namespacedName = `${namespace}_${fieldName}`;

  return [
    `${fieldName}: `,
    query.returnsList ? '' : 'head(',
    `[${namespacedName} IN `,
    buildCustomSubqueryClause({
      query,
      fieldName: namespacedName,
      parentName,
      hasContext,
    }),
    ` | ${namespacedName} `,
    buildFields({
      query,
      parentName: namespacedName,
      parentWasRelationship: query.returnsRelationship,
      namespace: namespacedName,
      hasContext,
    }),
    `]`,
    query.returnsList ? '' : ')',
  ].join('');
};

const buildFields = ({
  query,
  parentName,
  namespace,
  parentWasRelationship,
  hasContext,
}: {
  query: CypherQuery;
  parentName: string;
  namespace: string;
  parentWasRelationship: boolean;
  hasContext: boolean;
}) => {
  if (!query.fields.length) {
    return '';
  }

  return [
    '{',
    query.fields
      .map(fieldName => {
        const fieldQuery = query.fieldQueries[fieldName];

        if (!fieldQuery) {
          return `.${fieldName}`;
        }

        if (fieldQuery.kind === 'BuilderCypherQuery') {
          throw new Error(
            'Nesting Cypher builder fields is not currently possible'
          );
        } else if (fieldQuery.kind === 'NodeCypherQuery') {
          return buildNodeField({
            fieldName,
            parentName,
            query: fieldQuery,
            parentWasRelationship,
            namespace,
            hasContext,
          });
        } else if (fieldQuery.kind === 'RelationshipCypherQuery') {
          return buildRelationshipField({
            fieldName,
            parentName,
            query: fieldQuery,
            namespace,
            hasContext,
          });
        } else if (fieldQuery.kind === 'CustomCypherQuery') {
          return buildCustomField({
            fieldName,
            parentName,
            query: fieldQuery,
            namespace,
            hasContext,
          });
        } else if (fieldQuery.kind === 'VirtualCypherQuery') {
          return buildVirtualField({
            fieldName,
            query: fieldQuery,
            namespace,
            parentName,
            hasContext,
          });
        } else if (fieldQuery.kind === 'LinkedNodesCypherQuery') {
          return buildLinkedNodesField({
            fieldName,
            query: fieldQuery,
            namespace,
            parentName,
            parentWasRelationship,
            hasContext,
          });
        } else if (fieldQuery.kind === 'ComputedCypherQuery') {
          return buildComputedField({
            fieldName,
            query: fieldQuery,
            namespace,
            parentName,
            hasContext,
          });
        }
      })
      .filter(Boolean)
      .join(', '),
    '}',
  ].join('');
};

const buildBuilderQuery = ({
  fieldName,
  query,
  hasContext,
}: {
  fieldName: string;
  query: BuilderCypherQuery;
  hasContext: boolean;
}) => {
  // will be used to replace parameter refererences with namespaced versions,
  // like $args -> $user_posts.args
  const namespaceParams = createParamNamespacer(fieldName, query.paramNames);

  const phrases = [
    // just renames an incoming $parent param to basic "parent"
    buildWith('$parent AS parent'),
    buildMatch(query.match),
    buildOptionalMatch(query.optionalMatch),
    ...query.create.map(buildCreate),
    ...query.merge.map(buildMerge),
    ...query.set.map(buildSet),
    ...query.delete.map(buildDelete),
    ...query.detachDelete.map(buildDetachDelete),
    ...query.remove.map(buildRemove),
  ];

  // add WHERE to pre-filter results if the user specified filters
  const filters = buildFilters({
    orderBy: query.orderBy,
    skip: query.skip,
    limit: query.limit,
  });
  if (filters) {
    const bindings = getBindings(
      buildPhrases([
        buildMatch(query.match),
        buildOptionalMatch(query.optionalMatch),
      ])
    );
    phrases.push(buildWith(bindings.join(', ')));
    phrases.push(filters);
  }

  // namespace params, then build into string query body
  const body = buildPhrases(phrases.map(namespaceParams));

  // RETURN must incorporate nested field patterns
  const fields = buildFields({
    query,
    parentName: query.return,
    namespace: fieldName,
    parentWasRelationship: false,
    hasContext,
  });
  return [body, buildReturn(`${query.return} ${fields} AS ${fieldName}`)].join(
    '\n'
  );
};

const buildCustomWriteQuery = ({
  query,
  fieldName,
  hasContext,
}: {
  query: CustomCypherQuery;
  fieldName: string;
  hasContext: boolean;
}) => {
  const parentVariableName = '$parent';

  return [
    `CALL apoc.cypher.doIt("`,
    `WITH $parent as parent`,
    ` ${escapeQuotes(query.cypher)}", {`,
    buildCustomSubqueryParams({
      params: query.paramNames,
      parentName: parentVariableName,
      fieldName,
      hasContext,
    }),
    `})`,
    `\n`,
    buildMultiValueYieldMapper({
      returnNames: [fieldName],
    }),
    `\n`,
    buildReturn(`${fieldName} `),
    buildFields({
      parentName: fieldName,
      query,
      parentWasRelationship: false,
      namespace: fieldName,
      hasContext,
    }),
    ` AS ${fieldName}`,
  ].join('');
};

const buildCustomReadQuery = ({
  query,
  fieldName,
  hasContext,
}: {
  query: CustomCypherQuery;
  fieldName: string;
  hasContext: boolean;
}) => {
  const parentVariableName = '$parent';

  return [
    `WITH `,
    buildCustomSubqueryClause({
      query,
      parentName: parentVariableName,
      fieldName,
      hasContext,
    }),
    query.returnsList ? ` AS x UNWIND x` : '',
    ` AS ${fieldName}`,
    `\n`,
    buildReturn(`${fieldName} `),
    buildFields({
      parentName: fieldName,
      query,
      parentWasRelationship: false,
      namespace: fieldName,
      hasContext,
    }),
    ` AS ${fieldName}`,
  ].join('');
};

const buildCustomQuery = ({
  fieldName,
  query,
  isWrite,
  hasContext,
}: {
  fieldName: string;
  query: CustomCypherQuery;
  isWrite: boolean;
  hasContext: boolean;
}) => {
  if (isWrite) {
    return buildCustomWriteQuery({ fieldName, query, hasContext });
  } else {
    return buildCustomReadQuery({ fieldName, query, hasContext });
  }
};

export const buildCypher = ({
  fieldName,
  query,
  isWrite,
  hasContext,
}: {
  fieldName: string;
  query: CypherQuery;
  isWrite: boolean;
  hasContext: boolean;
}) => {
  const safeName = safeVar(fieldName);

  if (query.kind === 'BuilderCypherQuery') {
    return buildBuilderQuery({
      fieldName: safeName,
      query,
      hasContext,
    });
  } else if (query.kind === 'CustomCypherQuery') {
    return buildCustomQuery({
      fieldName: safeName,
      query,
      isWrite,
      hasContext,
    });
  } else {
    throw new Error(
      'Cypher Node and Relationship directives are not valid starting points for a query. You probably added one to a field whose parent is not part of your Graph database, or to a root field. Always use Cypher Builder or Custom Cypher directives on root fields or fields whose parents are not resolved by Cypher.'
    );
  }
};
