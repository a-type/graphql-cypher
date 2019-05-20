import {
  GraphQLScalarType,
  GraphQLNamedType,
  GraphQLResolveInfo,
  ResponsePath,
  GraphQLObjectType,
  GraphQLInterfaceType,
} from 'graphql';
import { CypherPlaceholder, ExternalPlaceholder } from 'types';

export function isGraphqlScalarType(
  type: GraphQLNamedType
): type is GraphQLScalarType {
  return !(
    type instanceof GraphQLObjectType || type instanceof GraphQLInterfaceType
  );
}

export function isArrayType(type: GraphQLNamedType) {
  return type ? type.toString().startsWith('[') : false;
}

export function isRoot(info: GraphQLResolveInfo): boolean {
  return [info.schema.getQueryType(), info.schema.getMutationType()]
    .filter(Boolean)
    .some(rootType => !!rootType && rootType.name === info.parentType.name);
}

export function getFieldPath(info: GraphQLResolveInfo) {
  const path: (string | number)[] = [];
  let pathLink: ResponsePath | undefined = info.path;
  while (pathLink) {
    path.unshift(pathLink.key);
    pathLink = pathLink.prev;
  }

  return path;
}

// ultimately we end up with a resolved value like this...
/**
 * {
 *   _isCypher: true,
 *   _cypher: "MATCH (user:User {id:$args.id}) RETURN user",
 *
 *   // a field resolved from a non-cypher source becomes an external placeholder
 *   someExternalField: '{
 *     _isCypher: false,
 *     _resolver: [Function],
 *     _args: { foo: 'bar' },
 *     _info: { ... },
 *   },
 *   // another cypher field
 *   posts: {
 *     _isCypher: true,
 *     _cypher: "MATCH (parent)-[:AUTHOR_OF]->(post:Post) RETURN post"
 *   }
 * }
 */

/**
 * Creates a standard placeholder in the returned payload for a particular cypher field resolver.
 * Mutates the context to bookmark the place of this placeholder for easier resolution later
 */
export const createPlaceholder = (cypher: string): CypherPlaceholder => {
  return {
    __graphqlCypher: {
      isCypher: true,
      cypher,
    },
  };
};

export const isCypherPlaceholder = (
  placeholder: CypherPlaceholder | ExternalPlaceholder | null
): placeholder is CypherPlaceholder =>
  !!placeholder && placeholder.__graphqlCypher.isCypher;
export const isExternalPlaceholder = (
  placeholder: CypherPlaceholder | ExternalPlaceholder | null
): placeholder is ExternalPlaceholder =>
  !!placeholder && !placeholder.__graphqlCypher.isCypher;
