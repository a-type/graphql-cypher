import { CypherQuery } from './types';

const escapeQuotes = (string: string) => string.replace(/"/g, '\\"');
const safeVar = (v: any) => {
  const stringified = `${v}`;
  // https://neo4j.com/docs/developer-manual/current/cypher/syntax/naming/
  return stringified.replace(/[-!$%^&*()_+|~=`{}\[\]:";'<>?,.\/]/g, '_');
};

/**
 * Formats params for an apoc subquery statement:
 * bar: $bar, baz: $baz, parent: parentVar
 * Parent is special, it gets added if a parentName is passed in.
 */
const buildSubqueryParams = ({
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

/**
 * Creates a clause that runs a custom query statement:
 * apoc.cypher.runFirstColumnSingle("MATCH (foo:Foo {id: \"bar\"}) RETURN foo", {foo: $foo, parent: parentVar})
 * or
 * apoc.cypher.runFirstColumnMany("MATCH (bar:Bar) RETURN bar", {})
 * (for queries that expect to return a list)
 * or
 * apoc.cypher.doIt("CREATE (baz:Baz) RETURN baz", {})
 * (for write queries)
 * This basically lets us run arbitrary queries in their own context
 */
const buildSubqueryClause = ({
  query,
  prefix,
  parentName,
  isWrite,
}: {
  query: CypherQuery;
  prefix: string;
  parentName?: string;
  isWrite: boolean;
}) => {
  const apocFn = isWrite
    ? 'apoc.cypher.doIt'
    : 'apoc.cypher.runFirstColumn' + (query.returnsList ? 'Many' : 'Single');

  const parentRename =
    parentName && parentName.startsWith('$')
      ? `WITH $parent AS parent `
      : `WITH {parent} AS parent `;
  return `${apocFn}("${parentRename}${escapeQuotes(
    query.cypher
  )}", {${buildSubqueryParams({
    params: query.paramNames,
    prefix,
    parentName,
  })}})`;
};

/**
 * Creates either:
 * .foo
 * for a basic property-backed field, or
 * .bar: [parent_bar IN apoc.cypher ...]
 * for a query-backed field
 */
const buildField = ({
  fieldName,
  prefix,
  parentName,
  query,
}: {
  fieldName: string;
  prefix: string;
  parentName: string;
  query?: CypherQuery;
}): string => {
  if (!query) {
    return `.${fieldName}`;
  }

  const namespacedName = `${parentName}_${fieldName}`;
  const fieldPrefix = prefix + fieldName + '_';

  const fieldLabel = `${fieldName}: `;
  const fields = buildFields({
    prefix: fieldPrefix,
    parentName: namespacedName,
    query,
  });
  const listPrefix = `[${namespacedName} IN `;
  const listInfix = ` | ${namespacedName} `;
  const listSuffix = `]`;

  const listProjection =
    (query.returnsList ? '' : 'head(') +
    listPrefix +
    buildSubqueryClause({
      query,
      prefix: fieldPrefix,
      parentName,
      isWrite: false,
    }) +
    listInfix +
    fields +
    listSuffix +
    (query.returnsList ? '' : ')');

  return fieldLabel + listProjection;
};

/**
 * Creates this:
 * {.foo, .bar: [parent_bar IN apoc.cypher ...]}
 * which goes after a node RETURN value to indicate which fields
 * to select and how to query for sub-field queries
 */
const buildFields = ({
  prefix,
  parentName,
  query,
}: {
  prefix: string;
  parentName: string;
  query: CypherQuery;
}): string => {
  if (!query.fields.length) {
    return '';
  }

  return (
    `{` +
    query.fields
      .map(fieldName =>
        buildField({
          fieldName,
          prefix,
          parentName,
          query: query.fieldQueries[fieldName],
        })
      )
      .join(', ') +
    `}`
  );
};

export const buildCypherReadQuery = ({
  fieldName,
  query,
}: {
  fieldName: string;
  query: CypherQuery;
}) => {
  const safeName = safeVar(fieldName);
  const prefix = safeName + '_';

  // queries receive a parent variable representing the object that is
  // the parent to the resolver that runs them. This is only relevant to the
  // first-level query; all other queries will receive their parents natively
  // within the Cypher context
  const parentVariableName = '$parent';

  // if the return value is a list, we iterate and unwind. Otherwise,
  // we can just "AS foo" immediately from the subquery return
  const listUnwind = query.returnsList ? ' AS x UNWIND x' : '';

  return (
    `WITH ` +
    buildSubqueryClause({
      query,
      prefix,
      parentName: parentVariableName,
      isWrite: false,
    }) +
    `${listUnwind} AS \`${safeName}\` ` +
    `RETURN \`${safeName}\` ` +
    buildFields({ prefix, parentName: safeName, query }) +
    ` AS \`${safeName}\``
  );
};

export const buildCypherWriteQuery = ({
  fieldName,
  query,
}: {
  fieldName: string;
  query: CypherQuery;
}) => {
  const safeName = safeVar(fieldName);
  const prefix = safeName + '_';
  const parentVariableName = '$parent';
  // if the query doesn't return a list, we will index into the result array's 0th item
  const onlyTakeFirstItem = query.returnsList ? '' : '[0]';

  return (
    'CALL ' +
    buildSubqueryClause({
      query,
      prefix,
      parentName: parentVariableName,
      isWrite: true,
    }) +
    'YIELD value ' +
    `WITH apoc.map.values(value, [keys(value)[0]])${onlyTakeFirstItem} AS \`${safeName}\` ` +
    `RETURN \`${safeName}\` ` +
    buildFields({ prefix, parentName: safeName, query }) +
    ` AS \`${safeName}\``
  );
};

export const buildCypherQuery = ({
  fieldName,
  query,
  isWrite,
}: {
  fieldName: string;
  query: CypherQuery;
  isWrite: boolean;
}) => {
  if (isWrite) {
    return buildCypherWriteQuery({ fieldName, query });
  } else {
    return buildCypherReadQuery({ fieldName, query });
  }
};

/**
 * recursively flattens and builds a set of arg object variables for a query
 * and all its sub-queries
 */
const buildPrefixedFieldArgVariables = ({
  prefix,
  query,
}: {
  prefix: string;
  query: CypherQuery;
}) => ({
  [`${prefix}args`]: query.params.args,
  [`${prefix}generated`]: query.params.generated,
  ...query.fields
    .filter(fieldName => !!query.fieldQueries[fieldName])
    .reduce(
      (args, fieldName) => ({
        ...args,
        ...buildPrefixedFieldArgVariables({
          prefix: prefix + fieldName + '_',
          query: query.fieldQueries[fieldName],
        }),
      }),
      {}
    ),
});

export const buildPrefixedVariables = ({
  fieldName,
  query,
  parent,
  contextValues,
}: {
  fieldName: string;
  query: CypherQuery;
  parent?: any;
  contextValues?: any;
}) => {
  const safeName = safeVar(fieldName);
  const prefix = safeName + '_';

  return {
    // passing the parent as a variable lets us cross the graphql -> graphdb boundary
    // and give queries access to their parent objects from our GraphQL context
    parent,
    // the user may supply values in their context which they always want passed to queries
    context: contextValues,

    ...buildPrefixedFieldArgVariables({ prefix, query }),
  };
};
