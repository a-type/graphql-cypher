import { middleware } from '../../src';
import { makeExecutableSchema } from 'graphql-tools';
import { applyMiddleware } from 'graphql-middleware';

export const typeDefs = `
input CypherConditionalStatement { statement: String!, when: String }
directive @cypher(
  statement: String
  statements: [CypherConditionalStatement!]
) on FIELD_DEFINITION

input Pagination {
  first: Int
  offset: Int
}

input PostFilter {
  titleMatch: String
}

type Post {
  id: ID!
  title: String!
  body: String!
}

type UserSettings {
  id: ID!
  homepage: String!
}

type User {
  id: ID!
  name: String!
  email: String!

  posts(
    pagination: Pagination = { first: 10, offset: 0 }
    filter: PostFilter
  ): [Post!]!
    @cypher(statements: [
      {
        when: "$args.filter"
        statement: """
          MATCH (parent)-[:AUTHOR_OF]->(post:Post)
          WHERE post.title =~ $args.filter.titleMatch
          RETURN post
          SKIP $args.pagination.offset
          LIMIT $args.pagination.first
        """
      },
      {
        statement: """
          MATCH (parent)-[:AUTHOR_OF]->(post:Post)
          RETURN post
          SKIP $args.pagination.offset
          LIMIT $args.pagination.first
        """
      }
    ])

  settings: UserSettings! # not resolved by cypher
}

type Query {
  user(id: ID!): User
    @cypher(
      statement: """
      MATCH (user:User {id: $args.id}) RETURN user
      """
    )
}
`;

export const resolvers = {};

const schema = applyMiddleware(
  makeExecutableSchema({
    typeDefs,
    resolvers,
  }),
  middleware
);

export default schema;
