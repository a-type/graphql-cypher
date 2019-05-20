import { GraphQLFieldResolver, GraphQLResolveInfo } from 'graphql';
import { v1 } from 'neo4j-driver';

export type GenericResolver = GraphQLFieldResolver<
  any,
  any,
  { [key: string]: any }
>;

export type CypherPlaceholder = {
  __graphqlCypher: {
    isCypher: true;
    cypher: string;
  };
};

export type ExternalPlaceholder = {
  __graphqlCypher: {
    isCypher: false;
    resolver: GenericResolver;
    args: { [key: string]: any };
    info: GraphQLResolveInfo;
  };
};

export type CypherQuery = {
  cypher: string;
  fields: string[];
  fieldQueries: {
    [fieldName: string]: CypherQuery;
  };
};

export type CypherQueryFieldMap = Map<string[], CypherQuery>;

export type ExtractQueryTraversalInfo = {
  parent: CypherPlaceholder | ExternalPlaceholder | null;
  fieldName: string;
  path: string[];
};

export type ResolveTraversalInfo = {
  parent: any;
  fieldName: string;
  path: string[];
  queries: CypherQueryFieldMap;
  transaction: v1.Transaction;
};
