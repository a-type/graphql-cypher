import { AugmentedContext } from './types';
import { GraphQLResolveInfo, defaultFieldResolver } from 'graphql';

/**
 * The default resolver for graphql-cypher, it will automatically fetch
 * the data for the field from your graph database if the field is annotated
 * with a graphql-cypher directive.
 */
export const defaultCypherResolver = async (
  parent: any,
  args: any,
  ctx: AugmentedContext,
  info: GraphQLResolveInfo
) => {
  if (ctx.runCypher) {
    const data = await ctx.runCypher();
    return data;
  }
  return defaultFieldResolver(parent, args, ctx, info);
};
