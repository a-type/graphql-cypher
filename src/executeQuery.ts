import { CypherQuery } from './types';
import { v1 } from 'neo4j-driver';

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
const buildSubqueryParams = (
  params: string[],
  prefix: string,
  parentName?: string
): string => {
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
 * apoc.cypher.runFirstColumn("MATCH (foo:Foo {id: \"bar\"}) RETURN foo", {foo: $foo, parent: parentVar}, true)
 * This basically lets us run arbitrary queries in their own context
 */
const buildSubqueryClause = (
  query: CypherQuery,
  prefix: string,
  parentName?: string
) =>
  `apoc.cypher.runFirstColumn("${escapeQuotes(
    query.cypher
  )}", {${buildSubqueryParams(query.params, prefix, parentName)}}, true)`;

/**
 * Creates either:
 * .foo
 * for a basic property-backed field, or
 * .bar: [parent_bar IN apoc.cypher ...]
 * for a query-backed field
 */
const buildField = (
  fieldName: string,
  prefix: string,
  parentName: string,
  query?: CypherQuery
): string => {
  if (!query) {
    return `.${fieldName}`;
  }

  const namespacedName = `${parentName}_${fieldName}`;
  const fieldPrefix = prefix + fieldName + '_';

  return (
    `.${fieldName}: [${namespacedName} IN ` +
    buildSubqueryClause(query, fieldPrefix, parentName) +
    ` | ${namespacedName} ${buildFields(fieldPrefix, namespacedName, query)}]`
  );
};

/**
 * Creates this:
 * {.foo, .bar: [parent_bar IN apoc.cypher ...]}
 * which goes after a node RETURN value to indicate which fields
 * to select and how to query for sub-field queries
 */
const buildFields = (
  prefix: string,
  parentName: string,
  query: CypherQuery
): string => {
  if (!query.fields.length) {
    return '';
  }

  return (
    `{` +
    query.fields
      .map(fieldName =>
        buildField(fieldName, prefix, parentName, query.fieldQueries[fieldName])
      )
      .join(', ') +
    `}`
  );
};

export const buildQuery = (fieldName: string, query: CypherQuery) => {
  const safeName = safeVar(fieldName);
  const prefix = safeName + '_';

  return (
    `WITH ` +
    buildSubqueryClause(query, prefix) +
    ` AS x UNWIND x AS \`${safeName}\` ` +
    `RETURN \`${safeName}\` ` +
    buildFields(prefix, safeName, query) +
    ` AS \`${safeName}\``
  );
};

export const executeCypherQuery = (
  fieldName: string,
  query: CypherQuery,
  driver: v1.Driver
) => {
  const cypher = buildQuery(fieldName, query);
};
