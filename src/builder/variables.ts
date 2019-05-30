import { CypherQuery } from '../types';
import { safeVar } from './language';

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
