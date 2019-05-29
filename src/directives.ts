import { SchemaDirectiveVisitor } from 'graphql-tools';
import {
  GraphQLField,
  GraphQLResolveInfo,
  defaultFieldResolver,
} from 'graphql';
import { AugmentedContext } from './types';

/**
 * The @cypher directive doesn't do a lot of work internally, but it does define a new default resolver
 * for fields that use it. The real magic of @cypher happens when the middleware reads the arguments
 * to the directives directly from the schema before execution.
 */
export class CustomCypherDirective extends SchemaDirectiveVisitor {
  visitFieldDefinition(field: GraphQLField<any, any>) {
    const { resolve } = field;
    if (!resolve) {
      field.resolve = async (
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
    }
  }
}
