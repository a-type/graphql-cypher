import { GraphQLResolveInfo } from 'graphql';
import { isRootField, getFieldPath } from './utils';
import { extractCypherQueriesFromOperation } from './scanQueries';
import { AugmentedContext } from './types';

export const middleware = async (
  resolve: Function,
  parent: any,
  args: { [key: string]: any },
  context: AugmentedContext,
  info: GraphQLResolveInfo
) => {
  if (isRootField(info.parentType, info.schema)) {
    context.__graphqlCypher = {
      cypherQueries: extractCypherQueriesFromOperation(info),
    };
  }

  const path = getFieldPath(info);
  if (context.__graphqlCypher.cypherQueries[path.join(',')]) {
  }

  return resolve(parent, args, context, info);
};
