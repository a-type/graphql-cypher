import { DirectiveNames } from './types';
import { DEFAULT_DIRECTIVE_NAMES } from './constants';

/**
 * If your GraphQL server requires explicit type definitions for all
 * directives, you can use this function to create some. Pass an argument with
 * customized names for the directives if you have changed them, or call it
 * without arguments to generate default type definitions.
 */
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
directive @${directiveNames.cypherLinkedNodes}(
  relationship: String!
  direction: CypherRelationshipDirection
  label: String
  where: String
  skip: String
  limit: String
) on FIELD_DEFINITION
directive @${directiveNames.cypherComputed}(
  value: String!
) on FIELD_DEFINITION
`;
