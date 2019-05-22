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

export const buildCypherQuery = (fieldName: string, query: CypherQuery) => {
  const safeName = safeVar(fieldName);
  const prefix = safeName + '_';

  // queries receive a parent variable representing the object that is
  // the parent to the resolver that runs them. This is only relevant to the
  // first-level query; all other queries will receive their parents natively
  // within the Cypher context
  const parentVariableName = '$parent';

  return (
    `WITH ` +
    buildSubqueryClause(query, prefix, parentVariableName) +
    ` AS x UNWIND x AS \`${safeName}\` ` +
    `RETURN \`${safeName}\` ` +
    buildFields(prefix, safeName, query) +
    ` AS \`${safeName}\``
  );
};

/**
 * recursively flattens and builds a set of arg object variables for a query
 * and all its sub-queries
 */
const buildPrefixedFieldArgVariables = (
  prefix: string,
  query: CypherQuery
) => ({
  [`${prefix}args`]: query.args,
  ...query.fields
    .filter(fieldName => !!query.fieldQueries[fieldName])
    .reduce(
      (args, fieldName) =>
        buildPrefixedFieldArgVariables(
          prefix + fieldName + '_',
          query.fieldQueries[fieldName]
        ),
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

    ...buildPrefixedFieldArgVariables(prefix, query),
  };
};

export const executeCypherQuery = async ({
  fieldName,
  cypher,
  variables,
  session,
  write = false,
  isList,
}: {
  fieldName: string;
  cypher: string;
  variables: { [name: string]: any };
  session: v1.Session;
  isList: boolean;
  write?: boolean;
}): Promise<any> => {
  const transaction = write
    ? session.writeTransaction
    : session.readTransaction;

  const data = await transaction(async tx => {
    const result = await tx.run(cypher, variables);
    if (result.records && result.records.length) {
      if (isList) {
        return result.records.map(record => record.get(fieldName));
      } else {
        return result.records[0].get('fieldName');
      }
    }
    return null;
  });

  return data;
};
