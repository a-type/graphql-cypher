import { SchemaDirectiveVisitor } from 'graphql-tools';
import {
  GraphQLField,
  GraphQLResolveInfo,
  defaultFieldResolver,
} from 'graphql';
import { AugmentedContext, DirectiveNames } from './types';
import { DEFAULT_DIRECTIVE_NAMES } from './constants';

/**
 * The @cypher directive doesn't do a lot of work internally, but it does define a new default resolver
 * for fields that use it. The real magic of @cypher happens when the middleware reads the arguments
 * to the directives directly from the schema before execution.
 */
export class BaseCypherDirective extends SchemaDirectiveVisitor {
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

export class CypherCustomDirective extends BaseCypherDirective {}
export class CypherDirective extends BaseCypherDirective {}
export class CypherNodeDirective extends BaseCypherDirective {}
export class CypherRelationshipDirective extends BaseCypherDirective {}

export const directives = {
  cypherCustom: CypherCustomDirective,
  cypher: CypherDirective,
  cypherNode: CypherNodeDirective,
  cypherRelationship: CypherRelationshipDirective,
};

export const directiveTypeDefs = (
  directiveNames: DirectiveNames = DEFAULT_DIRECTIVE_NAMES
) => `
input CypherConditionalStatement {
  statement: String!
  when: String
}
enum CypherRelationshipDirection {
  IN
  OUT
}
directive @${
  directiveNames.cypherCustom
}(statement: String, statements: [CypherConditionalStatement!]) on FIELD_DEFINITION
directive @${directiveNames.cypherSkip} on FIELD_DEFINITION
directive @${directiveNames.cypher}(
  match: String
  optionalMatch: String
  create: String
  createMany: [String!]
  merge: String
  mergeMany: [String!]
  set: String
  setMany: [String!]
  delete: String
  deleteMany: [String!]
  detachDelete: String
  detachDeleteMany: [String!]
  remove: String
  removeMany: [String!]
  orderBy: String
  skip: String
  limit: String
  return: String
) on FIELD_DEFINITION
directive @${directiveNames.cypherNode}(
  relationship: String!
  direction: CypherRelationshipDirection!
  label: String
  where: String
) on FIELD_DEFINITION
directive @${directiveNames.cypherRelationship}(
  type: String!
  direction: CypherRelationshipDirection!
  nodeLabel: String
  where: String
) on FIELD_DEFINITION
directive @${directiveNames.generateId}(
  argName: String
) on FIELD_DEFINITION
directive @${directiveNames.cypherVirtual} on OBJECT
`;
