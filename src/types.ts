import {
  GraphQLFieldResolver,
  GraphQLResolveInfo,
  GraphQLSchema,
} from 'graphql';
import { v1 } from 'neo4j-driver';

export type GenericResolver = GraphQLFieldResolver<
  any,
  any,
  { [key: string]: any }
>;

export type CypherQuery = {
  cypher: string;
  params: string[];
  args: {
    [name: string]: any;
  };
  fields: string[];
  fieldQueries: {
    [fieldName: string]: CypherQuery;
  };
};

export type CypherConditionalStatement = {
  statement: string;
  when?: string | null;
};

export type CypherDirectiveArgs = {
  statement?: string;
  statements?: CypherConditionalStatement[];
};

export type CypherQueryFieldMap = { [path: string]: CypherQuery };

export type ExtractQueryTraversalInfo = {
  path: string[];
  schema: GraphQLSchema;
};

export type ResolveTraversalInfo = {
  parent: any;
  fieldName: string;
  path: string[];
  queries: CypherQueryFieldMap;
  transaction: v1.Transaction;
};

export type AugmentedContext = { [key: string]: any } & {
  __graphqlCypher: {
    cypherQueries: CypherQueryFieldMap;
  };

  neo4jDriver: v1.Driver;
};
