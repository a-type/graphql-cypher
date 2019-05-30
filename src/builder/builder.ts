import {
  BuilderCypherQuery,
  CypherQuery,
  NodeCypherQuery,
  RelationshipCypherQuery,
  CustomCypherQuery,
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
} from './language';

const buildRelationshipField = ({
  fieldName,
  query,
  prefix,
  parentName,
}: {
  fieldName: string;
  query: RelationshipCypherQuery;
  prefix: string;
  parentName: string;
}) => {
  const namespacedName = `${parentName}_${fieldName}`;
  const fieldPrefix = prefix + fieldName + '_';

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
    buildNode({ label: query.nodeLabel }),
    '|',
    buildFields({
      prefix: fieldPrefix,
      parentName: namespacedName,
      query,
      parentWasRelationship: true,
    }),
    ']',
  ].join('');
};

const buildNodeField = ({
  fieldName,
  query,
  prefix,
  parentName,
  parentWasRelationship,
}: {
  fieldName: string;
  query: NodeCypherQuery;
  prefix: string;
  parentName: string;
  parentWasRelationship: boolean;
}) => {
  const namespacedName = `${parentName}_${fieldName}`;
  const fieldPrefix = prefix + fieldName + '_';

  return [
    `${fieldName}: `,
    query.returnsList ? '' : 'head(',
    '[',
    buildNode({ binding: parentWasRelationship ? undefined : parentName }),
    buildRelationship({
      binding: parentWasRelationship ? parentName : undefined,
      label: query.relationship,
      direction: query.direction,
    }),
    buildNode({ binding: namespacedName, label: query.label }),
    '|',
    buildFields({
      prefix: fieldPrefix,
      parentName: namespacedName,
      query,
      parentWasRelationship: false,
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
  prefix,
  parentName,
}: {
  params: string[];
  prefix: string;
  parentName?: string;
}): string => {
  const paramTuples: [string, string][] = params.map(key => [
    key,
    `$${prefix}${key}`,
  ]);
  if (parentName) {
    paramTuples.push(['parent', parentName]);
  }

  return paramTuples.map(([name, value]) => `${name}: ${value}`).join(', ');
};

const buildParentRename = (parentName?: string) =>
  parentName && parentName.startsWith('$')
    ? `WITH $parent AS parent`
    : `WITH {parent} AS parent`;

const buildCustomSubqueryClause = ({
  query,
  prefix,
  parentName,
}: {
  query: CustomCypherQuery;
  prefix: string;
  parentName?: string;
}): string => {
  const parentRename = buildParentRename(parentName);
  const apocFn =
    'apoc.cypher.runFirstColumn' + (query.returnsList ? 'Many' : 'Single');

  return [
    `${apocFn}(`,
    `"${parentRename} `,
    escapeQuotes(query.cypher),
    `", {`,
    buildCustomSubqueryParams({
      params: query.paramNames,
      prefix,
      parentName,
    }),
    `})`,
  ].join('');
};

const buildCustomField = ({
  fieldName,
  prefix,
  parentName,
  query,
}: {
  fieldName: string;
  prefix: string;
  parentName: string;
  query: CustomCypherQuery;
}) => {
  const namespacedName = `${parentName}_${fieldName}`;
  const fieldPrefix = prefix + fieldName + '_';

  return [
    `${fieldName}: `,
    query.returnsList ? '' : 'head(',
    `[${namespacedName} IN `,
    buildCustomSubqueryClause({
      query,
      prefix: fieldPrefix,
      parentName,
    }),
    ` | ${namespacedName} `,
    buildFields({
      query,
      prefix: fieldPrefix,
      parentName: namespacedName,
      parentWasRelationship: false,
    }),
    `]`,
    query.returnsList ? '' : ')',
  ].join('');
};

const buildFields = ({
  query,
  prefix,
  parentName,
  parentWasRelationship,
}: {
  query: CypherQuery;
  prefix: string;
  parentName: string;
  parentWasRelationship: boolean;
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
          throw new Error('Nesting Cypher builder fields is TODO');
        } else if (fieldQuery.kind === 'NodeCypherQuery') {
          return buildNodeField({
            fieldName,
            prefix,
            parentName,
            query: fieldQuery,
            parentWasRelationship,
          });
        } else if (fieldQuery.kind === 'RelationshipCypherQuery') {
          return buildRelationshipField({
            fieldName,
            prefix,
            parentName,
            query: fieldQuery,
          });
        } else if (fieldQuery.kind === 'CustomCypherQuery') {
          return buildCustomField({
            fieldName,
            prefix,
            parentName,
            query: fieldQuery,
          });
        }
      })
      .join(', '),
    '}',
  ].join('');
};

const buildBuilderQuery = ({
  fieldName,
  query,
}: {
  fieldName: string;
  query: BuilderCypherQuery;
}) => {
  const prefix = fieldName + '_';

  const phrases = [
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
    phrases.push(buildWith(fieldName));
    phrases.push(filters);
  }

  const body = buildPhrases(phrases);

  // RETURN must incorporate nested field patterns
  const fields = buildFields({
    query,
    prefix,
    parentName: fieldName,
    parentWasRelationship: false,
  });
  return [body, buildReturn(`${fieldName} ${fields}`)].join('\n');
};

const buildCustomWriteQuery = ({
  query,
  fieldName,
}: {
  query: CustomCypherQuery;
  fieldName: string;
}) => {
  const prefix = fieldName + '_';
  const parentVariableName = '$parent';

  return [
    `CALL apoc.cypher.doIt("`,
    buildParentRename(parentVariableName),
    ` ${escapeQuotes(query.cypher)}", {`,
    buildCustomSubqueryParams({
      params: query.paramNames,
      prefix,
      parentName: parentVariableName,
    }),
    `})`,
    `\n`,
    buildMultiValueYieldMapper({
      returnNames: [fieldName],
    }),
    `\n`,
    buildReturn(`\`${fieldName}\` `),
    buildFields({
      prefix,
      parentName: fieldName,
      query,
      parentWasRelationship: false,
    }),
    ` AS \`${fieldName}\``,
  ].join('');
};

const buildCustomReadQuery = ({
  query,
  fieldName,
}: {
  query: CustomCypherQuery;
  fieldName: string;
}) => {
  const prefix = fieldName + '_';
  const parentVariableName = '$parent';

  return [
    `WITH `,
    buildCustomSubqueryClause({
      query,
      prefix,
      parentName: parentVariableName,
    }),
    query.returnsList ? ` AS x UNWIND x` : '',
    ` AS \`${fieldName}\``,
    `\n`,
    buildReturn(`\`${fieldName}\` `),
    buildFields({
      prefix,
      parentName: fieldName,
      query,
      parentWasRelationship: false,
    }),
    ` AS \`${fieldName}\``,
  ].join('');
};

const buildCustomQuery = ({
  fieldName,
  query,
  isWrite,
}: {
  fieldName: string;
  query: CustomCypherQuery;
  isWrite: boolean;
}) => {
  if (isWrite) {
    return buildCustomWriteQuery({ fieldName, query });
  } else {
    return buildCustomReadQuery({ fieldName, query });
  }
};

export const buildCypher = ({
  fieldName,
  query,
  isWrite,
}: {
  fieldName: string;
  query: CypherQuery;
  isWrite: boolean;
}) => {
  const safeName = safeVar(fieldName);

  if (query.kind === 'BuilderCypherQuery') {
    return buildBuilderQuery({
      fieldName: safeName,
      query,
    });
  } else if (query.kind === 'CustomCypherQuery') {
    return buildCustomQuery({
      fieldName: safeName,
      query,
      isWrite,
    });
  } else {
    throw new Error(
      'Cypher Node and Relationship directives are not valid starting points for a query. You probably added one to a field whose parent is not part of your Graph database, or to a root field. Always use Cypher Builder or Custom Cypher directives on root fields or fields whose parents are not resolved by Cypher.'
    );
  }
};
